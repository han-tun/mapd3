import * as d3 from "./helpers/d3-service"

import {keys, dashStylesTranslation} from "./helpers/constants"
import {cloneData, override} from "./helpers/common"
import {formatOddDateBin, multiFormat} from "./helpers/formatters"

export default function Tooltip (_container, isLegend = false) {

  let config = {
    margin: {
      top: 2,
      right: 2,
      bottom: 2,
      left: 2
    },
    width: 250,
    height: 45,

    dateFormat: "%b %d, %Y",
    numberFormat: null,
    tooltipIsEnabled: true,
    tooltipTitle: null,

    // from chart
    binningResolution: null,
    binningIsAuto: null,
    chartType: null,
    colorSchema: ["skyblue"],
    keyType: "time"
  }

  let scales = {
    colorScale: null,
    styleScale: null
  }

  const cache = {
    container: _container,
    root: null,
    chartWidth: null,
    chartHeight: null,
    tooltipDivider: null,
    tooltipBody: null,
    tooltipTitle: null,
    tooltipBackground: null,
    xPosition: null,
    yPosition: null,
    content: null,
    title: null
  }

  let data = {
    dataBySeries: null,
    groupKeys: null,
    stack: null,
    stackData: null
  }

  function build () {
    cache.chartWidth = config.width - config.margin.left - config.margin.right
    cache.chartHeight = config.height - config.margin.top - config.margin.bottom

    if (!cache.root) {
      cache.root = cache.container.append("div")
          .attr("class", isLegend ? "legend-group" : "tooltip-group")
          .style("position", "absolute")

      const panel = cache.root.append("div")
        .attr("class", "tooltip-panel")

      cache.tooltipTitleSection = panel.append("div")
          .attr("class", "tooltip-title-section")

      cache.tooltipTitle = cache.tooltipTitleSection.append("div")
          .attr("class", "tooltip-title")

      cache.tooltipBody = panel.append("div")
          .attr("class", "tooltip-body")

      if (isLegend) {
        cache.tooltipTitleSection.append("div")
          .attr("class", "tooltip-collapse")
          .html("↗")

        cache.tooltipTitleSection.on("click", function () {
          const isCollapsed = this.classList.toggle("collapsed")
          toggleCollapse(isCollapsed)
        })
      } else {
        cache.root.style("pointer-events", "none")
      }

      if (!config.tooltipIsEnabled) {
        hide()
      }
    }

    if (isLegend) {
      cache.root.style("max-height", cache.chartHeight)
      if (config.tooltipIsEnabled) {
        show()
      } else {
        hide()
      }
    }
  }

  function calculateTooltipPosition (_mouseX, _mouseY) {
    const OFFSET = 4
    const tooltipSize = cache.root.node().getBoundingClientRect()
    const tooltipX = _mouseX
    let avoidanceOffset = OFFSET
    const tooltipY = _mouseY + config.margin.top - tooltipSize.height / 2

    if (_mouseX > (cache.chartWidth / 2)) {
      avoidanceOffset = -tooltipSize.width - OFFSET
    }
    return [tooltipX + avoidanceOffset, tooltipY]
  }

  function move () {
    const xPosition = cache.xPosition === "auto"
        ? cache.chartWidth
        : cache.xPosition

    const yPosition = cache.yPosition === "auto"
        ? config.margin.top
        : cache.yPosition

    cache.root
      .style("top", `${yPosition}px`)
      .style("left", function left () {
        const width = cache.xPosition === "auto" ? this.getBoundingClientRect().width : 0
        return `${xPosition + config.margin.left - width}px`
      })

    if (isLegend) {
      // set max-height in case there are too many legend items
      cache.root.style("max-height", `${cache.chartHeight}px`)
    }

    return this
  }

  function autoFormat (d) {
    let yFormat = ".2f"
    if (d < 1) {
      yFormat = ".2f"
    } else if (d < 100) {
      yFormat = ".1f"
    } else if (d < 1000) {
      yFormat = ".0f"
    } else if (d < 100000) {
      yFormat = ".2s"
    } else {
      yFormat = ".2s"
    }
    return yFormat
  }

  function drawContent () {
    const tooltipItems = cache.tooltipBody.selectAll(".tooltip-item")
        .data(cache.content)
    const tooltipItemsUpdate = tooltipItems.enter().append("div")
      .attr("class", "tooltip-item")
      .merge(tooltipItems)
    tooltipItems.exit().remove()

    const tooltipItem = tooltipItemsUpdate.selectAll(".section")
      .data((d) => {
        const legendData = [
          {
            key: "tooltip-color",
            value: scales.colorScale(d[keys.ID]),
            style: scales.styleScale(d[keys.ID])
          },
        ]

        if (isLegend) {
          legendData.push({key: "tooltip-label", value: d[keys.LABEL]})
        }

        if (typeof d[keys.VALUE] !== "undefined") {
          legendData.push({key: "value", value: d[keys.VALUE]})
        }
        return legendData
      })
    tooltipItem.enter().append("div")
      .merge(tooltipItem)
      .attr("class", (d) => ["section", d.key].join(" "))
      .each(function each (d) {
        const selection = d3.select(this)
        if (d.key === "tooltip-color") {
          const size = 12
          const offset = size / 2
          const svg = selection
            .html("<svg></svg>")
            .select("svg")
            .attr("width", size)
            .attr("height", size)

          if (config.chartType === "line") {
            svg
              .append("line")
              .attr("x1", 0)
              .attr("y1", offset)
              .attr("x2", size)
              .attr("y2", offset)
              .attr("stroke", d.value)
              .attr("stroke-width", 2.5)
              .attr("stroke-dasharray", d => {
                return dashStylesTranslation[d.style]
              })
          } else {
            svg
              .append("rect")
              .attr("x", 0)
              .attr("y", 0)
              .attr("width", size)
              .attr("height", size)
              .style("fill", d.value)
          }
        } else if (d.key === "value") {
          selection.html(d3.format(autoFormat(d.value))(d.value))
        } else {
          selection.html(d.value)
        }
      })
    tooltipItem.exit().remove()

    return this
  }

  function toggleCollapse (isCollapsed) {
    if (isCollapsed) {
      cache.tooltipTitle.html("Legend")
      cache.tooltipBody.style("display", "none")
      move()
    } else {
      drawTitle()
      cache.tooltipBody.style("display", "block")
      move()
    }
    return this
  }

  function drawTitle () {
    let title = config.tooltipTitle || cache.title
    // translate bin from human readable code to d3 time format specifier
    // TO DO: handle special cases such as "decade" that should display an non-normal value like "1991 - 2000"
    const binTranslation = {
      "1c": "",
      "10y": "",
      "1y": "%Y",
      "1q": "",
      "1mo": "%B",
      "1s": "%S",
      "1m": "%M",
      "1h": "%H",
      "1d": "%A",
      "1w": "%U"
    }

    // format date if we have a date
    if (title instanceof Date) {
      const { binningResolution } = config;
      let specifier = binTranslation[binningResolution]

      if (specifier) {
        title = d3.utcFormat(specifier)(title)
      } else if (["1c", "10y", "1q"].includes(binningResolution)) {
        // handle exceptions for bin translation specifiers (century, decade, quarter)
        title = formatOddDateBin(binningResolution, title, data)
      } else {
        title = d3.utcFormat(config.dateFormat)(title)
      }
    }

    cache.tooltipTitle.html(title)
    return this
  }

  function setupContent (_series) {
    let series = _series

    cache.content = sortSeries(series)
    return this
  }

  function sortSeries (_series) {
    return [..._series].sort((a, b) => b[keys.VALUE] - a[keys.VALUE])
  }

  function hide () {
    if (!cache.root) { return null }
    cache.root.style("display", "none")
    return this
  }

  function show () {
    if (!cache.root || !config.tooltipIsEnabled) { return null }
    cache.root.style("display", "block")
    return this
  }

  function setupTooltip (_dataPoint, _xPosition, _yPosition) {
    build()
    const [tooltipX, tooltipY] = calculateTooltipPosition(_xPosition, _yPosition)
    setXPosition(tooltipX)
    setYPosition(tooltipY)
    setTitle(_dataPoint[keys.KEY])
    setupContent(_dataPoint[keys.SERIES])

    render()
    return this
  }

  function bindEvents (_dispatcher) {
    _dispatcher.on("mouseOverPanel.tooltip", show)
      .on("mouseMovePanel.tooltip", setupTooltip)
      .on("mouseOutPanel.tooltip", hide)
    return this
  }

  function setConfig (_config) {
    config = override(config, _config)
    return this
  }

  function setScales (_scales) {
    scales = override(scales, _scales)
    return this
  }

  function setData (_data) {
    data = Object.assign({}, data, _data)
    return this
  }

  function setTitle (_title) {
    cache.title = _title
    return this
  }

  function setXPosition (_xPosition) {
    cache.xPosition = _xPosition
    return this
  }

  function setYPosition (_yPosition) {
    cache.yPosition = _yPosition
    return this
  }

  function setContent (_content) {
    cache.content = _content
    return this
  }

  function render () {
    build()
    drawTitle()
    drawContent()
    move()
    return this
  }

  function destroy () {
    if (cache.root) {
      cache.root.remove()
      cache.root = null
    }
    return this
  }

  return {
    bindEvents,
    setXPosition,
    setYPosition,
    setContent,
    setTitle,
    hide,
    show,
    render,
    setConfig,
    setScales,
    setData,
    destroy
  }
}

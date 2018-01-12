import * as d3 from "./helpers/d3-service"

import {keys, LEFT_AXIS_GROUP_INDEX, RIGHT_AXIS_GROUP_INDEX} from "./helpers/constants"
import {getUnique, override} from "./helpers/common"

export default function Scale () {

  let config = {
    margin: {
      top: 60,
      right: 30,
      bottom: 40,
      left: 70
    },
    height: null,
    width: null,
    keyType: null,
    chartType: null,
    colorSchema: null,
    defaultColor: null,
    xDomain: "auto",
    yDomain: "auto",
    y2Domain: "auto"
  }

  let data = {
    dataByKey: null,
    dataBySeries: null,
    flatDataSorted: null,
    groupKeys: null
  }

  const getID = (d) => d[keys.ID]
  const getKey = (d) => d[keys.DATA]
  const getValue = (d) => d[keys.VALUE]

  function buildXScale (_allKeys) {
    const chartWidth = config.width - config.margin.left - config.margin.right
    let xScale = null
    let domain = null

    if (config.keyType === "time") {
      xScale = d3.scaleTime()
    } else if (config.keyType === "number") {
      xScale = d3.scaleLinear()
    } else {
      xScale = (config.chartType === "bar" || config.chartType === "stackedBar") ? d3.scaleBand() : d3.scalePoint()
      xScale.padding(0)
    }

    if (config.xDomain === "auto") {
      if (config.keyType === "string") {
        domain = _allKeys
      } else {
        domain = d3.extent(_allKeys)
      }
    } else {
      domain = config.xDomain
    }

    xScale.domain(domain)
      .range([0, chartWidth])

    return xScale
  }

  function buildYScale (_extent) {
    const chartHeight = config.height - config.margin.top - config.margin.bottom
    const yScale = d3.scaleLinear()
        .domain(_extent)
        .rangeRound([chartHeight, 0])

    return yScale
  }

  function buildColorScale () {
    const ids = data.dataBySeries.map(getID)
    const colorScale = d3.scaleOrdinal()
        .range(config.colorSchema.map((d) => d.value))
        .domain(config.colorSchema.map((d, i) => d.key || ids[i]))
        .unknown(config.defaultColor)

    return colorScale
  }

  function splitByGroups () {
    const groups = {}
    data.dataBySeries.forEach((d) => {
      const key = d[keys.GROUP]
      if (!groups[key]) {
        groups[key] = {
          allValues: [],
          allKeys: []
        }
      }
      groups[key].allValues = groups[key].allValues.concat(d[keys.VALUES].map(getValue))
      groups[key].allKeys = groups[key].allKeys.concat(d[keys.VALUES].map(getKey))
    })

    return groups
  }

  function getStackedScales () {
    const allStackHeights = data.dataByKey.map((d) => d3.sum(d.series.map((dB) => dB.value)))

    const allKeys = data.flatDataSorted.map(getKey)
    const allUniqueKeys = getUnique(allKeys)

    const xScale = buildXScale(allUniqueKeys)
    const colorScale = buildColorScale()

    let yDomain = null
    if (config.yDomain === "auto") {
      const valuesExtent = d3.extent(allStackHeights)
      yDomain = [0, valuesExtent[1]]
    } else {
      yDomain = config.yDomain
    }
    const yScale = buildYScale(yDomain)

    return {
      xScale,
      yScale,
      colorScale
    }
  }

  function getHorizontalScales () {
    const groups = splitByGroups()
    const groupKeys = Object.keys(groups) || []

    const hasLeftAxis = groupKeys.indexOf(LEFT_AXIS_GROUP_INDEX) > -1
    const hasRightAxis = groupKeys.indexOf(RIGHT_AXIS_GROUP_INDEX) > -1

    const allUniqueKeys = data.dataByKey.map(d => d.key)
    const xScale = buildXScale(allUniqueKeys)

    const colorScale = buildColorScale()

    let yScale = null
    if (hasLeftAxis) {
      let yDomain = null
      if (config.yDomain === "auto") {
        const groupLeftAxis = groups[LEFT_AXIS_GROUP_INDEX]
        yDomain = d3.extent(groupLeftAxis.allValues)
      } else {
        yDomain = config.yDomain
      }
      yScale = buildYScale(yDomain)
    }

    let y2Scale = null
    if (hasRightAxis) {
      let y2Domain = null
      if (config.y2Domain === "auto") {
        const groupRightAxis = groups[RIGHT_AXIS_GROUP_INDEX]
        y2Domain = d3.extent(groupRightAxis.allValues)
      } else {
        y2Domain = config.y2Domain
      }

      y2Scale = buildYScale(y2Domain)
    }

    return {
      hasSecondAxis: hasRightAxis,
      xScale,
      yScale,
      y2Scale,
      colorScale
    }
  }

  function getScales () {
    if (config.chartType === "stackedBar"
      || config.chartType === "stackedArea") {
      return getStackedScales()
    } else {
      return getHorizontalScales()
    }
  }

  function setConfig (_config) {
    config = override(config, _config)
    return this
  }

  function setData (_data) {
    data = Object.assign({}, data, _data)
    return this
  }

  return {
    setConfig,
    setData,
    getScales
  }
}

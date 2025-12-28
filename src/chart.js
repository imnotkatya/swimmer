import * as d3 from "d3";
import convertWideToLong from "./convertWideToLong";
import parseDate from "./parseDate";
import sort from "./sort";
import * as aq from "arquero";
import makeTable from "./makeTable";
import * as XLSX from "xlsx";

export function createScale(colors, property) {
  return d3
    .scaleOrdinal()
    .domain(colors.map((c) => c.key))
    .range(colors.map((c) => c[property]));
}

function getDomainX(parsedDatasetLong) {
  const times = parsedDatasetLong.rectangles
    .fold(["start", "end"], { as: ["type", "time"] })
    .concat(parsedDatasetLong.events.rename({ event: "time" }))
    .filter((d) => d.time >= 0)
    .array("time");
  return d3.extent(times);
}
export function convertStep(oxDimension) {
  if (typeof oxDimension === "string") {
    const normalizedStep = oxDimension.toLowerCase().trim();

    if (normalizedStep.includes("month")) {
      return 30.4375;
    } else if (normalizedStep.includes("year")) {
      return 365.25;
    } else if (normalizedStep.includes("week")) {
      return 7;
    }
  } else return oxDimension;
}
function drawLines(svg, lineRectangles, scales, x, y) {
  const { strokeColor, strokeWidth, strokeDash } = scales;

  return svg
    .selectAll(".line")
    .data(lineRectangles)
    .enter()
    .append("line")
    .attr("class", "line")
    .attr("x1", (d) => x(d.start))
    .attr("x2", (d) => x(d.end))
    .attr("y1", (d) => y(d._rowNumber) + y.bandwidth() / 2)
    .attr("y2", (d) => y(d._rowNumber) + y.bandwidth() / 2)
    .attr("stroke", (d) => strokeColor(d.nameOfFigure))
    .attr("stroke-width", (d) => strokeWidth(d.nameOfFigure))
    .attr("stroke-dasharray", (d) => strokeDash(d.nameOfFigure))
    .attr("opacity", (d) => (d.start >= 0 ? 1 : 0));
}

function drawRects(svg, otherRectangles, scales, x, y) {
  const {
    strokeDash,
    color,
    strokeColor,
    strokeWidth,
    yModified,
    columnHeight,
  } = scales;

  return svg
    .selectAll(".rects")
    .data(otherRectangles)
    .enter()
    .append("rect")
    .attr("stroke-dasharray", (d) => strokeDash(d.nameOfFigure))
    .attr("fill", (d) => color(d.nameOfFigure))
    .attr("stroke", (d) => strokeColor(d.nameOfFigure))
    .attr("opacity", (d) => (d.start >= 0 ? 1 : 0))
    .attr("stroke-width", (d) => strokeWidth(d.nameOfFigure))
    .attr(
      "y",
      (d) =>
        y(d._rowNumber) +
        (y.bandwidth() - columnHeight(d.nameOfFigure)) / 2 +
        yModified(d.nameOfFigure)
    )
    .attr("x", (d) => x(d.start))
    .attr("height", (d) => columnHeight(d.nameOfFigure))
    .attr("width", (d) => Math.max(0, x(d.end) - x(d.start)));
}

function drawEvents(svg, events, scales, x, y) {
  const { color, yModified, xModified, symbols, symbolSize } = scales;

  return svg
    .selectAll(".event")
    .data(events)
    .enter()
    .append("text")
    .attr("x", (d) => x(d.event) + xModified(d.nameOfFigure))
    .attr(
      "y",
      (d) => y(d._rowNumber) + y.bandwidth() / 2 + yModified(d.nameOfFigure)
    )
    .attr("opacity", (d) => (d.event >= 0 ? 1 : 0))
    .attr("fill", (d) => color(d.nameOfFigure))
    .style("font-size", (d) => symbolSize(d.nameOfFigure))
    .style("font-family", "SymbolsNerdFontMono-Regular, monospace")
    .style("text-anchor", "middle")
    .style("dominant-baseline", "middle")
    .text((d) => symbols(d.nameOfFigure));
}

function calculateTableWidth(tableData, fields) {
  const columnWidths = fields.map((field) => {
    const maxDataLength = tableData
      .derive({
        field_length: aq.escape((d) => String(d[field]).length),
      })
      .rollup({ max_length: aq.op.max("field_length") })
      .object().max_length;

    const headerText = field;
    const headerLength = String(headerText).length;

    const maxLength = Math.max(maxDataLength, headerLength);

    return Math.max(maxLength * 8, 80);
  });

  const totalWidth =
    columnWidths.slice(0, -1).reduce((sum, width) => sum + width, 0) + 40;

  return { columnWidths, totalWidth };
}

function drawTable(svg, tableData, patients, fields, y) {
  const { columnWidths } = calculateTableWidth(tableData, fields);
  const tableStartX = 20;
  fields.forEach((field, fieldIndex) => {
    if (fieldIndex === fields.length - 1) return;

    const columnX =
      tableStartX +
      columnWidths.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);

    svg
      .append("text")
      .attr("x", columnX + columnWidths[fieldIndex] / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .style("fill", "#191919ff")
      .text(field);
    svg
      .selectAll(`table_rows`)
      .data(patients)
      .enter()
      .append("text")
      .attr("class", `table-rows`)
      .attr("x", columnX + columnWidths[fieldIndex] / 2)
      .attr("y", (d) => y(d._rowNumber) + y.bandwidth() / 2 + 4)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("fill", "#333")
      .text((d) => d[field] || "");
  });
}

function calculateLegendWidth(uniqueLabels) {
  return (
    aq
      .from(uniqueLabels)
      .derive({ label_length: aq.escape((d) => String(d.label).length) })
      .rollup({ max_length: aq.op.max("label_length") })
      .object().max_length * 6
  );
}
function getTicks(minValue, maxValue, userStep) {
  return d3
    .range(
      Math.floor(minValue / userStep) * userStep,
      maxValue + userStep,
      userStep
    )
    .filter((value) => value <= maxValue);
}

function drawLegend(svg, scales, settingsContext, colors) {
  const {
    symbols,
    symbolSize,
    color,
    strokeColor,
    strokeWidth,
    strokeDash,
    typeFigure,
  } = scales;

  const uniqueLabels = aq
    .from(colors)
    .dedupe("label")
    .filter((d) => d.label !== "")
    .objects();

  const { marginTop, marginRight, width, height, marginBottom } =
    settingsContext;
  const legendHeight = uniqueLabels.length * 25;
  const legendStartY = height - marginTop - legendHeight - marginBottom / 2;
  const legendItemHeight = 25;

  const legendGroup = svg
    .append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width - marginRight}, ${legendStartY})`);

  uniqueLabels.forEach((colorObj, i) => {
    const key = colorObj.key;
    const symbol = symbols(key);

    if (symbol) {
      legendGroup
        .append("text")
        .attr("x", 0)
        .attr("y", i * legendItemHeight)
        .attr("text-anchor", "start")
        .attr("dy", "0.35em")
        .style("font-size", symbolSize(key))
        .text(symbol)
        .style("fill", color(key))
        .attr("stroke", strokeColor(key))
        .style("font-family", "SymbolsNerdFontMono-Regular, monospace")
        .attr("stroke-width", 0.5);
      return;
    }

    if (typeFigure(key) === "line") {
      legendGroup
        .append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", i * legendItemHeight)
        .attr("y2", i * legendItemHeight)
        .attr("stroke", strokeColor(key))
        .attr("stroke-width", strokeWidth(key))
        .attr("stroke-dasharray", strokeDash(key));
      return;
    }

    legendGroup
      .append("rect")
      .attr("x", 0)
      .attr("y", i * legendItemHeight - 10)
      .attr("width", 20)
      .attr("height", 15)
      .attr("stroke", strokeColor(key))
      .attr("stroke-dasharray", strokeDash(key))
      .attr("stroke-width", strokeWidth(key))
      .style("fill", color(key));
  });

  legendGroup
    .selectAll(".legend-label")
    .data(uniqueLabels)
    .enter()
    .append("text")
    .attr("x", 30)
    .attr("y", (d, i) => i * legendItemHeight)
    .attr("dy", "0.35em")
    .style("font-size", "16px")
    .text((d) => d.label);
}

function drawChart(processedData, container) {
  const {
    colors,
    baseSettings,
    parsedDatasetLong,
    tableData,
    patients,
    fields,
    uniqueNames,
    scales,
  } = processedData;

  const { width, height } = baseSettings;

  container.innerHTML = "";

  const uniqueLabels = aq
    .from(colors)
    .dedupe("label")
    .filter((d) => d.label !== "")
    .objects();

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + calculateLegendWidth(uniqueLabels))
    .attr("height", height);
  const { totalWidth: tableWidth } = calculateTableWidth(tableData, fields);
  const marginLeft = tableWidth + 20;
  const marginBottom = 100;
  const marginTop = 50;
  const marginRight = calculateLegendWidth(uniqueLabels);

  const settingsContext = {
    width,
    height,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
  };

  const y = d3
    .scaleBand()
    .domain(uniqueNames)
    .range([height - marginBottom, marginTop]);

  const x = d3
    .scaleLinear()
    .domain(getDomainX(parsedDatasetLong))
    .nice()

    .range([marginLeft, width - marginRight]);

  const userStep = baseSettings.step;
  const [minValue, maxValue] = x.domain();

  svg
    .append("g")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .call(d3.axisBottom(x).tickValues(getTicks(minValue, maxValue, userStep)))
    .style("font-size", "15px");
  svg
    .append("g")
    .attr("transform", `translate(${marginLeft},0)`)
    .call(d3.axisLeft(y).tickFormat(""));

  svg
    .append("text")
    .attr("class", "x-label")
    .attr("text-anchor", "middle")
    .attr("x", (width + tableWidth) / 2)
    .attr("y", height - marginBottom / 2)
    .style("font-size", "18px")
    .style("fill", "#333")
    .text(baseSettings.label);
  const rectanglesArray = parsedDatasetLong.rectangles.objects();
  const events = parsedDatasetLong.events.objects();

  const lineRectangles = rectanglesArray.filter(
    (d) => scales.typeFigure(d.nameOfFigure) === "line"
  );

  const otherRectangles = rectanglesArray.filter(
    (d) => scales.typeFigure(d.nameOfFigure) !== "line"
  );

  drawLines(svg, lineRectangles, scales, x, y);
  drawRects(svg, otherRectangles, scales, x, y);
  drawEvents(svg, events, scales, x, y);

  drawTable(svg, tableData, patients, fields, y);

  drawLegend(svg, scales, settingsContext, colors);
}

export async function drawPlot(processedData, chartContainer) {
  drawChart(processedData, chartContainer);
}

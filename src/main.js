import { drawPlot, createScale, convertStep } from "./chart.js";
import { setupFileUpload } from "./upload";
import convertWideToLong from "./convertWideToLong";
import parseDate from "./parseDate";
import sort from "./sort";
import * as aq from "arquero";
import makeTable from "./makeTable";
import * as XLSX from "xlsx";

function handleJsonUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const jsonData = JSON.parse(e.target.result);
      let stylesData, settingsData, datasetLongLoad;
      if (jsonData.styles && jsonData.settings && jsonData.data) {
        stylesData = jsonData.styles;
        settingsData = jsonData.settings;
        datasetLongLoad = jsonData.data;
      }

      resolve({
        stylesData: aq.from(stylesData),
        settingsData: aq.from(settingsData),
        datasetLongLoad: aq.from(datasetLongLoad),
      });
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsText(file);
  });
}
function handleExcelUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "array" });
      const toTable = (sheet) =>
        aq.from(
          XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: "" })
        );

      resolve({
        stylesData: toTable("styles"),
        settingsData: toTable("settings"),
        datasetLongLoad: toTable("data"),
      });
    };

    reader.onerror = () => reject(new Error("error"));
    reader.readAsArrayBuffer(file);
  });
}
function processData(raw) {
  const { stylesData, datasetLongLoad, settingsData } = raw;
  const settings = settingsData.objects().reduce((acc, d) => {
    acc[d.measure] = d.value;
    return acc;
  }, {});

  const colors = stylesData.objects().map((d) => ({
    key: d.key,
    type: d.type,
    color: d.color,
    label: d.label,
    strokeDash: +d.stroke_dash,
    yModify: +d.y_modify,
    xModify: +d.x_modify,
    stroke: d.stroke,
    symbol: d.symbol,
    symbolSize: +d.symbol_size,
    columnHeight: +d.column_height || 30,
    strokeWidth: +d["stroke-width"],
  }));
  const baseSettings = {
    width: settings.width || 1600,
    height: settings.height || 900,
    label: settings.label || "",
    step: settings.step || 5,
    oxDimension: convertStep(settings.oxDimension),
  };
  const minD = stylesData.objects()[0].key;
  const { oxDimension } = baseSettings;
  const datasetLong = parseDate(datasetLongLoad, minD, oxDimension);
  const parsedDatasetLong = convertWideToLong(datasetLong);
  const sortedData = sort(parsedDatasetLong);
  const tableData = makeTable(datasetLong, minD);
  const patients = tableData.objects();

  const fields = tableData.columnNames();
  const uniqueNames = sortedData.groupby("_rowNumber").array("_rowNumber");

  const scales = {
    color: createScale(colors, "color"),
    strokeColor: createScale(colors, "stroke"),
    strokeDash: createScale(colors, "strokeDash"),
    strokeWidth: createScale(colors, "strokeWidth"),
    yModified: createScale(colors, "yModify"),
    xModified: createScale(colors, "xModify"),
    symbolSize: createScale(colors, "symbolSize"),
    symbols: createScale(colors, "symbol"),
    typeFigure: createScale(colors, "type"),
    columnHeight: createScale(colors, "columnHeight"),
  };

  return {
    colors,
    baseSettings,
    parsedDatasetLong,
    tableData,
    patients,
    fields,
    uniqueNames,
    scales,
  };
}

const defaultHandle = (file) => {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".json")) {
    return handleJsonUpload(file);
  } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    return handleExcelUpload(file);
  } else {
    throw new Error(`error`);
  }
};
const STYLES = `
  @font-face {
    font-family: 'SymbolsNerdFontMono-Regular';
    src: url('./SymbolsNerdFontMono-Regular.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: block;
  }
  body {
    margin: 0;
    padding: 0;
  }
  .app-container {
    min-height: 100vh;
    background: white;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    cursor: pointer;
  }
  .header {
    text-align: center;
    background: #f8f9fa;
    margin-bottom: 0;
  }
  .header h1 {
    font-weight: normal;
    color: #2c3e50;
    margin: 0;
    padding: 20px 0;
  }
  .upload-section {
    text-align: center;
    padding: 40px;
  }
  .upload-text {
    font-size: 18pt;
    color: #495057;
    margin-bottom: 1rem;
  }
  .upload-subtext {
    font-size: 12pt;
    color: #6c757d;
  }
  .images {
    display: flex;
    flex-direction: row;
    gap: 120px;
    margin-top: 20px;
  }
  .hidden {
    display: none;
  }
  img {
    width: 500px;
    height: 300px;
    border: 1px solid #dee2e6;
  }

  .instructions {
    margin-top: 30px;
    text-align: left;
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
  }
  #text-instructions p {
    font-size: 16pt;
    color: #495057;
    margin-bottom: 20px;
  }
  #drop-zone {
    background: #f8f9fa;
    border: 2px dashed #dee2e6;
    border-radius: 8px;
    padding: 3rem 2rem;
    margin: 0 auto;
    max-width: 500px;
    transition: all 0.3s ease;
  }


`;

const APP_TEMPLATE = `
  <div class="app-container">
    <div class="header">
      <h1>Swimmer Plot</h1>
    </div>
    
    <div class="upload-section">
      <div id="drop-zone">
        <div class="upload-text">Нажмите в любом месте или перетащите Excel файл</div>
        <div class="upload-subtext">Поддерживаются файлы .xlsx, .xls</div>
      </div>
      <div class="instructions">
        <div id="text-instructions">
          <p>Для работы с данной программой нужно...</p>
          <div class="images">
            <div id="excel-template">
            <a href="info_template.xlsx" download>
               <img src="./data.png" alt="Пример данных Excel">
                <p><center>Пример данных Excel</center></p>
              </a>
            </div>
            <div id="plot-template">
             <img src="./result.png" alt="Пример графика">
              <p><center>Пример графика</center></p>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div id="chartContent"></div>
    
    <input type="file" id="excelFile" accept=".xlsx, .xls" class="hidden" />
  </div>
`;

export function main(container) {
  const style = document.createElement("style");
  style.textContent = STYLES;
  document.head.appendChild(style);

  container.innerHTML = `
    <div>
      <div class="card">
        <div id="chart-container">
          ${APP_TEMPLATE}
        </div>
      </div>
    </div>
  `;

  const chartContainer = container.querySelector("#chart-container");

  setupFileUpload(chartContainer, async (file) => {
    await drawPlot(
      processData(await defaultHandle(file)),
      chartContainer.querySelector("#chartContent")
    );
  });
}

const container = document.querySelector("#app");
main(container);

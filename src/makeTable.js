import * as aq from "arquero";

export default function (dataset, minD) {
  const table = aq.from(dataset);
  const columns = table.columnNames();
  const minDate =
    columns.indexOf(minD + "___start") || columns.indexOf(minD + "___event");

  return table.select(aq.range(0, minDate - 1), "_rowNumber");
}

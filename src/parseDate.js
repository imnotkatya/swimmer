import * as aq from "arquero";

function parseDateUniversal(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const cleaned = value.trim();
    const formats = [
      cleaned,
      cleaned.replace(/\./g, "-"),
      cleaned.includes("T") ? cleaned : `${cleaned}T00:00:00`,
    ];

    for (const format of formats) {
      const date = new Date(format);
      if (!isNaN(date.getTime())) return date;
    }

    return null;
  }

  if (typeof value === "number") {
    if (value > 1000) {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      return isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export default function (dataset, minD, oxDimension) {
  const availableColumns = dataset.columnNames();
  const val =
    availableColumns.find((col) => col === minD + "___event") ||
    availableColumns.find((col) => col === minD + "___start");

  const result = aq
    .from(dataset)
    .derive({
      minDate: aq.escape((d) => d[val]),
      _rowNumber: aq.op.row_number(),
    })
    .derive(
      Object.fromEntries(
        aq
          .from(dataset)
          .columnNames()
          .filter(
            (col) =>
              col.endsWith("___start") ||
              col.endsWith("___end") ||
              col.endsWith("___event")
          )
          .map((col) => [
            col,
            aq.escape((d) => {
              const date1 = parseDateUniversal(d[col]);
              const date2 = parseDateUniversal(d.minDate);

              return (date1 - date2) / (1000 * 60 * 60 * 24) / oxDimension;
            }),
          ])
      )
    );

  return result;
}

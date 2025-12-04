import * as aq from "arquero";

export default function (dataset) {
  const rectangles = aq
    .from(dataset)
    .select(aq.endswith("___start"), aq.endswith("___end"), "_rowNumber")

    .fold(aq.endswith("___start"), { as: ["start_key", "start"] })
    .fold(aq.endswith("___end"), { as: ["end_key", "end"] })
    .derive({
      start_key: (d) => aq.op.replace(d.start_key, "___start", ""),
      end_key: (d) => aq.op.replace(d.end_key, "___end", ""),
    })
    .filter((d) => d.start_key === d.end_key)
    .rename({ start_key: "nameOfFigure", end_key: "nameOfFigure" });
  return rectangles;
}

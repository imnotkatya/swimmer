import * as aq from "arquero";
export default function (data) {
  const rects = aq
    .from(data.rectangles)
    .select("start", "end", "nameOfFigure", "_rowNumber");
  const events = aq
    .from(data.events)
    .select("event", "nameOfFigure", "_rowNumber")
    .rename({ event: "end" });

  const combined = rects
    .concat(events)
    .groupby("_rowNumber")
    .rollup({
      max_end: aq.op.max("end"),
    })
    .orderby("max_end");
  return combined;
}

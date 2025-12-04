import * as aq from "arquero";

export default function (dataset) {
  const events = aq
    .from(dataset)
    .select(aq.endswith("___event"), "_rowNumber")
    .fold(aq.endswith("___event"), { as: ["event_key", "event"] })
    .derive({
      nameOfFigure: (d) => aq.op.replace(d.event_key, "___event", ""),
    });

  return events;
}

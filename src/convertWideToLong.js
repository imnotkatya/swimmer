import rectanglesConvert from "./rectanglesConvert";
import eventConvert from "./eventConvert";
export default function (dataset) {
  const result = {
    events: [],
    rectangles: [],
  };

  result.rectangles = rectanglesConvert(dataset);
  result.events = eventConvert(dataset);
  return result;
}

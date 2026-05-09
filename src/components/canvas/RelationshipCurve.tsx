import { Circle, Group, Shape } from "react-konva";

type Point = {
  x: number;
  y: number;
};

type RelationshipCurveProps = {
  start: Point;
  control: Point;
  end: Point;
  stageScale: number;
  onControlDragMove: (point: Point) => void;
};

export function RelationshipCurve({
  start,
  control,
  end,
  stageScale,
  onControlDragMove,
}: RelationshipCurveProps) {
  const strokeWidth = 1.5 / stageScale;
  const handleRadius = 4.5 / stageScale;
  const handleHitRadius = 12 / stageScale;
  const curveMidpoint = quadraticPoint(start, control, end, 0.5);

  return (
    <Group>
      <Shape
        listening={false}
        stroke="#737373"
        fill="#737373"
        opacity={0.52}
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.quadraticCurveTo(control.x, control.y, end.x, end.y);
          context.setLineDash([6 / stageScale, 9 / stageScale]);
          context.lineWidth = strokeWidth;
          context.lineCap = "round";
          context.strokeShape(shape);
          context.setLineDash([]);

          const angle = Math.atan2(end.y - control.y, end.x - control.x);
          const headLength = 11 / stageScale;
          const headWidth = 6 / stageScale;
          context.beginPath();
          context.moveTo(end.x, end.y);
          context.lineTo(
            end.x - headLength * Math.cos(angle) + headWidth * Math.sin(angle),
            end.y - headLength * Math.sin(angle) - headWidth * Math.cos(angle)
          );
          context.lineTo(
            end.x - headLength * Math.cos(angle) - headWidth * Math.sin(angle),
            end.y - headLength * Math.sin(angle) + headWidth * Math.cos(angle)
          );
          context.closePath();
          context.fillStrokeShape(shape);
        }}
      />
      <Circle
        x={curveMidpoint.x}
        y={curveMidpoint.y}
        radius={handleHitRadius}
        fill="rgba(0,0,0,0)"
        draggable
        onMouseDown={(event) => {
          event.cancelBubble = true;
        }}
        onTouchStart={(event) => {
          event.cancelBubble = true;
        }}
        onDragMove={(event) => {
          event.cancelBubble = true;
          onControlDragMove(
            controlFromCurveMidpoint(start, end, event.target.position())
          );
        }}
        onDragEnd={(event) => {
          event.cancelBubble = true;
          onControlDragMove(
            controlFromCurveMidpoint(start, end, event.target.position())
          );
        }}
      />
      <Circle
        x={curveMidpoint.x}
        y={curveMidpoint.y}
        radius={handleRadius}
        fill="#fafafa"
        stroke="#737373"
        strokeWidth={1.25 / stageScale}
        listening={false}
      />
    </Group>
  );
}

function quadraticPoint(start: Point, control: Point, end: Point, t: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
    y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y,
  };
}

function controlFromCurveMidpoint(start: Point, end: Point, midpoint: Point) {
  return {
    x: 2 * midpoint.x - (start.x + end.x) / 2,
    y: 2 * midpoint.y - (start.y + end.y) / 2,
  };
}

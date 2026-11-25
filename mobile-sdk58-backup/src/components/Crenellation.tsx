import { useState } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

interface CrenellationProps {
  /** Color of the teeth; use the color of the area below so they appear to rise out of it. */
  fill: string;
  height?: number;
  toothWidth?: number;
  gap?: number;
}

/**
 * A row of triangular crenellations, the parapet that tops traditional Najdi mud-brick
 * buildings in Riyadh. It is the one decorative element in the app and marks the line
 * between the green header and the content below it.
 */
export function Crenellation({ fill, height = 10, toothWidth = 14, gap = 5 }: CrenellationProps) {
  const [width, setWidth] = useState(0);
  const step = toothWidth + gap;
  const count = width > 0 ? Math.ceil(width / step) + 1 : 0;

  let d = "";
  for (let i = 0; i < count; i++) {
    const x = i * step - gap;
    d += `M${x} ${height} L${x + toothWidth / 2} 0 L${x + toothWidth} ${height} Z `;
  }

  return (
    <View
      style={{ height, overflow: "hidden" }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          <Path d={d} fill={fill} />
        </Svg>
      )}
    </View>
  );
}

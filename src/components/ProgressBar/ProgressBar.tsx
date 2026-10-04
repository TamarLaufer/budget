import { format } from "../../strings/format";
import { strings } from "../../strings/he";
import { Fill, Track } from "./ProgressBar.styles";

interface ProgressBarProps {
  /** Fill between 0 and 1. */
  fill: number;
  /** Percent shown to screen readers; may exceed 100. */
  percentUsed: number;
  isOver: boolean;
}

export function ProgressBar({ fill, percentUsed, isOver }: ProgressBarProps) {
  return (
    <Track
      accessibilityRole="progressbar"
      accessibilityValue={{ text: format(strings.PERCENT, { percent: percentUsed }) }}
    >
      <Fill $fill={fill} $isOver={isOver} />
    </Track>
  );
}

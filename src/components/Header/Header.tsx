import { HeaderContainer, Month, MonthRow, NavButton, NavText, Title } from "./Header.styles";
import { strings } from "../../strings/he";
import { formatMonthYear } from "../../budget/calculations";

type Props = {
  month: Date;
  /** When provided, arrows let the user move between months. */
  onPrevious?: () => void;
  onNext?: () => void;
  title?: string;
};

const Header = ({ month, onPrevious, onNext, title = strings.MY_BUDGET }: Props) => {
  return (
    <HeaderContainer>
      <Title accessibilityRole="header">{title}</Title>
      <MonthRow>
        {onPrevious ? (
          <NavButton onPress={onPrevious} accessibilityRole="button" accessibilityLabel={strings.PREVIOUS_MONTH} hitSlop={12}>
            {/* In RTL the previous month is on the right, so the arrow points right. */}
            <NavText>→</NavText>
          </NavButton>
        ) : null}
        <Month accessibilityLiveRegion="polite">{formatMonthYear(month)}</Month>
        {onNext ? (
          <NavButton onPress={onNext} accessibilityRole="button" accessibilityLabel={strings.NEXT_MONTH} hitSlop={12}>
            <NavText>←</NavText>
          </NavButton>
        ) : null}
      </MonthRow>
    </HeaderContainer>
  );
};

export default Header;

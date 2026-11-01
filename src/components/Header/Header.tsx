import { HeaderContainer, Month, MonthRow, NavButton, Title } from "./Header.styles";
import { strings } from "../../strings/he";
import { formatMonthYear } from "../../budget/calculations";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../theme";

type Props = {
  month: Date;
  /** When provided, arrows let the user move between months. */
  onPrevious?: () => void;
  onNext?: () => void;
  title?: string;
};

const Header = ({ month, onPrevious, onNext, title = strings.APP_NAME }: Props) => {
  return (
    <HeaderContainer>
      <Title accessibilityRole="header">{title}</Title>
      <MonthRow>
        {onPrevious ? (
          <NavButton onPress={onPrevious} accessibilityRole="button" accessibilityLabel={strings.PREVIOUS_MONTH} hitSlop={12}>
            {/* In RTL the previous month is on the right, so the arrow points right. */}
            <Feather name="arrow-right" size={22} color={colors.primary} />
          </NavButton>
        ) : null}
        <Month accessibilityLiveRegion="polite">{formatMonthYear(month)}</Month>
        {onNext ? (
          <NavButton onPress={onNext} accessibilityRole="button" accessibilityLabel={strings.NEXT_MONTH} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={colors.primary} />
          </NavButton>
        ) : null}
      </MonthRow>
    </HeaderContainer>
  );
};

export default Header;

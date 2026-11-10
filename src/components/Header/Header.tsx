import type { ReactNode } from "react";
import { Feather } from "@expo/vector-icons";

import {
  HeaderContainer,
  HeaderActionSlot,
  Month,
  MonthRow,
  NavButton,
  Title,
  TitleCenter,
  TitleRow,
} from "./Header.styles";
import { strings } from "../../strings/he";
import { formatMonthYear } from "../../budget/calculations";
import { colors } from "../../theme";

type Props = {
  month: Date;
  onPrevious?: () => void;
  onNext?: () => void;
  title?: string;
  titleAction?: ReactNode;
};

const Header = ({
  month,
  onPrevious,
  onNext,
  title = strings.APP_NAME,
  titleAction,
}: Props) => {
  return (
    <HeaderContainer>
    <TitleRow>
      <HeaderActionSlot />

      <TitleCenter>
        <Title accessibilityRole="header">{title}</Title>
      </TitleCenter>

      <HeaderActionSlot>{titleAction}</HeaderActionSlot>
    </TitleRow>

      <MonthRow>
        {onPrevious ? (
          <NavButton
            onPress={onPrevious}
            accessibilityRole="button"
            accessibilityLabel={strings.PREVIOUS_MONTH}
            hitSlop={12}
          >
            <Feather name="arrow-right" size={22} color={colors.primary} />
          </NavButton>
        ) : null}

        <Month accessibilityLiveRegion="polite">
          {formatMonthYear(month)}
        </Month>

        {onNext ? (
          <NavButton
            onPress={onNext}
            accessibilityRole="button"
            accessibilityLabel={strings.NEXT_MONTH}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={22} color={colors.primary} />
          </NavButton>
        ) : null}

      </MonthRow>
    </HeaderContainer>
  );
};

export default Header;
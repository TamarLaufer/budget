import { HeaderContainer, Month, Title } from "./Header.styles";
import { strings } from "../../strings/he";
import { formatMonthYear } from "../../budget/calculations";

type Props = {
    month: Date;
}

const Header = ({month} : Props) => {

  return (
      <HeaderContainer>
        <Title accessibilityRole="header">{strings.MY_BUDGET}</Title>
        <Month>{formatMonthYear(month)}</Month>
      </HeaderContainer>
  )
}

export default Header

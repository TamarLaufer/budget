import { styled } from "styled-components/native";
import { colors } from "../../theme";

type ToggleBallPropsType = {
    $toggleBallSize: number;
}

type ToggleLinePropsType = {
    $toggleLineSize: number;
}

export const ToggleContainer = styled.View`
    justify-content: center;
    align-items: flex-end;
    margin: 12px;
`

export const ToggleText = styled.Text`
    font-size: 16px; 
    padding: 8px 0;
`
export const ToggleBall = styled.Pressable<ToggleBallPropsType>`
    width: ${({$toggleBallSize})=> $toggleBallSize}px;
    height: ${({$toggleBallSize})=> $toggleBallSize}px;
    background-color: ${colors.success};
    border-radius: ${({ $toggleBallSize }) => $toggleBallSize / 2}px;
`

export const ToggleLine = styled.View<ToggleLinePropsType>`
    width: ${({ $toggleLineSize }) => $toggleLineSize}px;
    height: 30px;
    background-color: ${colors.surface};
    border-radius: 30px;
    justify-content: center;
`
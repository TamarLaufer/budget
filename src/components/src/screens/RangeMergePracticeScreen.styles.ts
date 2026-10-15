import styled from "styled-components/native";


type CirclePropsType = {
    $inRange: boolean,
    $circleSize: number,
};

export const CircleContainer = styled.View`
    justify-content: center;
    align-items: center;
`;

export const Circle = styled.Pressable<CirclePropsType>`
    width: ${({$circleSize}) => $circleSize}px;
    height: ${({$circleSize}) => $circleSize}px;
    border-radius: ${({$circleSize})=> $circleSize/2}px;
    background-color: ${({$inRange})=> $inRange ? "tomato" : "green"};
    justify-content: center;
    align-items: center;

`

export const CircleText = styled.Text`
    font-size: 18px;
`
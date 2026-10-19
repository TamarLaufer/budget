import { ToggleContainer, ToggleText, ToggleBall, ToggleLine } from './TogglePracticeScreen.styles'
import { createAnimatedComponent, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"

const TogglePracticeScreen = () => {
    
const AnimatedToggleBall = createAnimatedComponent(ToggleBall);

  const toggleBallSize = 25;
  const toggleLineSize = 120;
  const toggleX = useSharedValue(0)
  const lineLengthInAction = toggleLineSize - toggleBallSize;

  const animatedStyle = useAnimatedStyle(()=>{
    return {
        transform: [{translateX: toggleX.value}],
    }
  })

  const onTogglePress = ()=>{
    toggleX.value = withTiming(toggleX.value === 0 ? lineLengthInAction : 0, {
        duration: 370,
    })
  }

  useAnimatedReaction(
    ()=>toggleX.value, 
    (currentValue, previousValue) => {
        console.log(currentValue, previousValue);
        
    }
  )

  

  return (
    <ToggleContainer>
      <ToggleText>לחץ לשינוי מצב</ToggleText>
        <ToggleLine $toggleLineSize={toggleLineSize}>
            <AnimatedToggleBall $toggleBallSize={toggleBallSize} onPress={onTogglePress} style={animatedStyle}/>
        </ToggleLine>
    </ToggleContainer>
  )
}

export default TogglePracticeScreen

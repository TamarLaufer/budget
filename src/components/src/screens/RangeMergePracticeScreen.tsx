import { View } from 'react-native'
import { Circle, CircleContainer, CircleText } from './RangeMergePracticeScreen.styles';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const RangeMergePracticeScreen = () => {

  const circles = [0, 1, 2, 3, 4, 5, 6];
  const circleSize = 35;
  const gap = 12;
  const inRange = true;

  const selectedStartIndex = useSharedValue<null | number>(null);
  const selectedEndIndex = useSharedValue<null | number>(null);

  const capsuleX = useSharedValue<number>(0)
  const capsuleWidth = useSharedValue(circleSize);

  const capsuleVisibility = useSharedValue(0);
  const step = gap + circleSize;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {translateX: capsuleX.value}, 
      ],
      opacity: capsuleVisibility.value,
      backgroundColor: "pink",
      width: capsuleWidth.value,
    }
  });

  const resetSelections =   ()=>{
    selectedStartIndex.value = null;
    selectedEndIndex.value = null;
    capsuleX.value = 0;
    capsuleWidth.value = circleSize;
    capsuleVisibility.value = 0;
  }


  const onCirclePress = (userSelection: number)=>{

    if (selectedStartIndex.value === null) {
      selectedStartIndex.value = userSelection;
      const targeX = userSelection * step;

      capsuleX.value = withTiming(targeX,{
          duration: 0,
      })
      capsuleVisibility.value = withTiming(1,{
        duration: 0,
      })

    } else if (selectedStartIndex.value !== null &&
      selectedEndIndex.value === null) {
         selectedEndIndex.value = userSelection;
         console.log("userSelection:", userSelection);
         console.log("end immediately after set:", selectedEndIndex.value);
      
      const distanceBetweenIndexes = userSelection - selectedStartIndex.value;

      const newWidth = Math.abs(distanceBetweenIndexes) * step + circleSize;
      console.log(newWidth, userSelection, 'newWidth');
      

      if (distanceBetweenIndexes >= 0) {
          capsuleWidth.value = withTiming(newWidth, {
          duration: 0,
      })
      } else {
        const growBy = newWidth - circleSize;
        const newX = capsuleX.value - growBy;
        capsuleX.value = withTiming(newX, {
        duration: 220,
        });
        capsuleWidth.value = withTiming(newWidth, {
        duration: 220,
      });
      }

    } else if (selectedStartIndex.value !== null && selectedEndIndex.value !== null) {
      resetSelections()
    }

    console.log(selectedStartIndex.value, selectedEndIndex.value);
  
  }
  

  return (
    <View style={{alignItems: "center", justifyContent: 'center', flexDirection: "row", padding: 30, gap}}>
          
        <Animated.View pointerEvents="none" style={[
          {
          width: circleSize,
          height: circleSize,
          position: 'absolute',
          borderRadius: circleSize/2,
          top: 30,
          left: 22,
          zIndex: 100,
          },
          animatedStyle
        ]}/>
      {circles.map((circle)=>{
        return (
        <CircleContainer key={circle}>
            <Circle onPress={()=>onCirclePress(circle)} $circleSize={circleSize} $inRange={inRange}><CircleText>{circle}</CircleText></Circle>
        </CircleContainer>)
      })}
    </View>
  )
}

export default RangeMergePracticeScreen
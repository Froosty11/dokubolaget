import { type ReactNode, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { USE_NATIVE_DRIVER } from "../animation";

type AnimatedCellSlotProps = {
  slotStyle: StyleProp<ViewStyle>;
  cellStyle: StyleProp<ViewStyle>;
  filled: boolean;
  // Increments each time this cell is freshly solved → flip-in.
  flipNonce: number;
  // Increments on each wrong guess for this cell → shake.
  shakeNonce: number;
  // Position on the board, used to stagger the idle shimmer.
  index: number;
  shimmerColor: string;
  radius: number;
  onPress: () => void;
  children: ReactNode;
};

export function AnimatedCellSlot(props: AnimatedCellSlotProps) {
  const flip = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!props.flipNonce) return;
    flip.setValue(0);
    Animated.spring(flip, {
      toValue: 1,
      friction: 5,
      tension: 70,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [props.flipNonce]);

  useEffect(() => {
    if (!props.shakeNonce) return;
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 7, -7, 4, -4, 0].map((toValue) =>
        Animated.timing(shake, {
          toValue,
          duration: 45,
          easing: Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ),
    ).start();
  }, [props.shakeNonce]);

  // Empty cells breathe gently so the board invites a tap.
  useEffect(() => {
    if (props.filled) {
      shimmer.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(props.index * 160),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.delay(2600 - props.index * 160),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [props.filled, props.index]);

  const rotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ["90deg", "0deg"] });
  const scale = flip.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <Animated.View
      style={[
        props.slotStyle,
        {
          transform: [{ perspective: 600 }, { translateX: shake }, { rotateY }, { scale }],
        },
      ]}
    >
      <Pressable style={props.cellStyle} onPress={props.onPress}>
        {!props.filled ? (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: props.radius,
                backgroundColor: props.shimmerColor,
                opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0, 0.75] }),
              },
            ]}
          />
        ) : null}
        {props.children}
      </Pressable>
    </Animated.View>
  );
}

export type HeaderRevealState = "pending" | "animate" | "shown";

type AnimatedHeaderProps = {
  slotStyle: StyleProp<ViewStyle>;
  reveal: HeaderRevealState;
  revealOrder: number;
  // Increments when a near miss matched this header → pulse.
  pulseNonce: number;
  pulseColor: string;
  radius: number;
  children: ReactNode;
};

export function AnimatedHeader(props: AnimatedHeaderProps) {
  const appear = useRef(new Animated.Value(props.reveal === "shown" ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (props.reveal === "shown") {
      appear.setValue(1);
    } else if (props.reveal === "animate") {
      appear.setValue(0);
      Animated.spring(appear, {
        toValue: 1,
        delay: 150 + props.revealOrder * 110,
        friction: 6,
        tension: 60,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }
  }, [props.reveal]);

  useEffect(() => {
    if (!props.pulseNonce) return;
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 180, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(pulse, { toValue: 0, duration: 260, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(pulse, { toValue: 1, duration: 180, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(pulse, { toValue: 0, duration: 420, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [props.pulseNonce]);

  const translateY = appear.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });

  return (
    <Animated.View
      style={[
        props.slotStyle,
        { opacity: appear, transform: [{ translateY }, { scale: pulseScale }] },
      ]}
    >
      {props.children}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            margin: 5,
            borderRadius: props.radius,
            borderWidth: 3,
            borderColor: props.pulseColor,
            opacity: pulse,
          },
        ]}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: props.pulseColor, opacity: 0.12 }]} />
      </Animated.View>
    </Animated.View>
  );
}

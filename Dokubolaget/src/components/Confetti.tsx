import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { USE_NATIVE_DRIVER, seededRandom } from "../animation";

const COLORS = ["#007a33", "#ffd400", "#ff5a5f", "#2d9cdb", "#ff9f1c", "#9b5de5"];

type Particle = {
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  fall: number;
  sway: number;
  rotation: number;
  size: number;
  round: boolean;
  color: string;
  delay: number;
  duration: number;
};

export type ConfettiProps =
  | {
      mode: "burst";
      // Burst origin, relative to the parent the confetti is rendered in.
      x: number;
      y: number;
      count?: number;
      seed: number;
      onDone?: () => void;
    }
  | {
      mode: "rain";
      width: number;
      height: number;
      count?: number;
      seed: number;
      onDone?: () => void;
    };

function buildParticles(props: ConfettiProps): Particle[] {
  const random = seededRandom(props.seed);
  const count = props.count ?? (props.mode === "burst" ? 28 : 110);
  const particles: Particle[] = [];

  for (let index = 0; index < count; index += 1) {
    const size = 6 + random() * 6;
    const base = {
      size,
      round: random() < 0.3,
      color: COLORS[Math.floor(random() * COLORS.length)],
      rotation: (random() < 0.5 ? -1 : 1) * (240 + random() * 480),
    };

    if (props.mode === "burst") {
      // Fan upwards between roughly 200° and 340° (screen coordinates).
      const angle = ((200 + random() * 140) * Math.PI) / 180;
      const speed = 60 + random() * 110;
      particles.push({
        ...base,
        startX: props.x - size / 2,
        startY: props.y - size / 2,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        fall: 110 + random() * 110,
        sway: 0,
        delay: random() * 60,
        duration: 900 + random() * 500,
      });
    } else {
      particles.push({
        ...base,
        startX: random() * props.width,
        startY: -20 - random() * 60,
        dx: 0,
        dy: 0,
        fall: props.height + 100,
        sway: 18 + random() * 30,
        delay: random() * 1100,
        duration: 2300 + random() * 1500,
      });
    }
  }
  return particles;
}

// Lightweight confetti built on the core Animated API so it runs the same on
// web, iOS and Android without extra native dependencies.
export function Confetti(props: ConfettiProps) {
  const particles = useMemo(() => buildParticles(props), [props.seed]);
  const progress = useRef(particles.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animation = Animated.parallel(
      particles.map((particle, index) =>
        Animated.timing(progress[index], {
          toValue: 1,
          duration: particle.duration,
          delay: particle.delay,
          easing: props.mode === "burst" ? Easing.out(Easing.quad) : Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ),
    );
    animation.start(({ finished }) => {
      if (finished) props.onDone?.();
    });
    return () => animation.stop();
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((particle, index) => {
        const t = progress[index];
        const translateX =
          props.mode === "burst"
            ? t.interpolate({ inputRange: [0, 1], outputRange: [0, particle.dx * 1.4] })
            : t.interpolate({
                inputRange: [0, 0.25, 0.5, 0.75, 1],
                outputRange: [0, particle.sway, 0, -particle.sway, 0],
              });
        const translateY =
          props.mode === "burst"
            ? t.interpolate({
                inputRange: [0, 0.35, 1],
                outputRange: [0, particle.dy, particle.dy + particle.fall],
              })
            : t.interpolate({ inputRange: [0, 1], outputRange: [0, particle.fall] });
        const rotate = t.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${particle.rotation}deg`],
        });
        const opacity = t.interpolate({
          inputRange: [0, 0.75, 1],
          outputRange: [1, 1, 0],
        });

        return (
          <Animated.View
            key={index}
            style={{
              position: "absolute",
              left: particle.startX,
              top: particle.startY,
              width: particle.size,
              height: particle.round ? particle.size : particle.size * 0.45,
              borderRadius: particle.round ? particle.size / 2 : 1,
              backgroundColor: particle.color,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { USE_NATIVE_DRIVER, seededRandom } from "../animation";
import { useReducedMotion } from "../theme/ThemeProvider";
import type { ConfettiShape } from "../theme/types";

const DEFAULT_COLORS = ["#007a33", "#ffd400", "#ff5a5f", "#2d9cdb", "#ff9f1c", "#9b5de5"];

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

type ConfettiLook = {
  shape?: ConfettiShape;
  colors?: string[];
};

export type ConfettiProps = ConfettiLook &
  ({
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
    });

function buildParticles(props: ConfettiProps): Particle[] {
  const random = seededRandom(props.seed);
  const count = props.count ?? (props.mode === "burst" ? 28 : 110);
  const colors = props.colors?.length ? props.colors : DEFAULT_COLORS;
  const particles: Particle[] = [];

  for (let index = 0; index < count; index += 1) {
    const size = 6 + random() * 6;
    const base = {
      size,
      round: random() < 0.3,
      color: colors[Math.floor(random() * colors.length)],
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

// Each theme picks a particle shape: dots, flower petals, neon sparks, gold
// flecks or little paper price tags.
function shapeStyle(shape: ConfettiShape, particle: Particle): Record<string, any> {
  const size = particle.size;
  switch (shape) {
    case "petals":
      return {
        width: size * 1.3, height: size * 0.85,
        borderTopLeftRadius: size, borderBottomRightRadius: size,
        borderTopRightRadius: size * 0.2, borderBottomLeftRadius: size * 0.2,
      };
    case "sparks":
      return { width: 2.5, height: size * 1.8, borderRadius: 2, shadowColor: particle.color, shadowOpacity: 1, shadowRadius: 6 };
    case "flecks":
      return { width: size * 0.55, height: size * 0.55, borderRadius: 1 };
    case "priceTags":
      return { width: size * 2.2, height: size * 1.25, borderRadius: 2, borderTopRightRadius: size, borderBottomRightRadius: size };
    default:
      return { width: size, height: particle.round ? size : size * 0.45, borderRadius: particle.round ? size / 2 : 1 };
  }
}

// Lightweight confetti built on the core Animated API so it runs the same on
// web, iOS and Android without extra native dependencies. Skipped entirely
// when the player prefers reduced motion.
export function Confetti(props: ConfettiProps) {
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) props.onDone?.();
  }, [reducedMotion]);
  if (reducedMotion) return null;
  return <ConfettiParticles {...props} />;
}

function ConfettiParticles(props: ConfettiProps) {
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
              ...shapeStyle(props.shape ?? "dots", particle),
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

import { ActivityIndicator, Text, View, useWindowDimensions } from "react-native";
import DokubolagetLogo from "../../assets/Dokubolaget3.svg";

type SuspenseViewProps = {
  promiseState: {
    promise?: Promise<any>;
    data?: any;
    error?: any;
  };
  children: React.ReactNode;
};

export function SuspenseView({
  promiseState,
  children,
}: SuspenseViewProps) {
  const { width: windowWidth } = useWindowDimensions();
  const boardSize = Math.min(windowWidth, 720);

  if (promiseState.error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 16, color: "#721c24" }}>
          {promiseState.error.toString()}
        </Text>
      </View>
    );
  }

  if (promiseState.promise && !promiseState.data) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
        }}
      >
        <View style={{ width: "40%", height: 100 }}>
          <DokubolagetLogo width="100%" height="100%" />
        </View>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { handleLoginACB, handleLogoutACB, authObserverCB } from "../reactjs/authPresenter";
import { FC, use, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Dialog, Input, YStack } from "tamagui";
import { SvgProps } from "react-native-svg";
import  Leaderboard  from "../reactjs/leaderboardPresenter";
import { Style } from "../AppStyles"
import  AuthDialog from "./authDialogView";
import DokubolagetLogo from "../../assets/Dokubolaget3.svg";
import Chevron from "../../assets/chevron.svg";
import Drinks from "../../assets/drinks.svg";
import Smakprofil from "../../assets/smakprofil.svg";


/* === INDEX OPTIONS === */

interface IndexOptionProps {
  Icon: FC<SvgProps>;
  text: string;
  onPress: () => void;
}

function IndexOption({ Icon, text, onPress }: IndexOptionProps) {
  return (
    <Pressable
      style={option.button}
      onPress={onPress}
    >
      <Icon width={32} height={32} />
      <View style={option.text}>
        <Text style={{fontFamily: "InterVariable"}}>{text}</Text>
        <Chevron width={24} height={24} opacity={0.65} />
      </View>
    </Pressable>
  )
}

const option = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 6,
    paddingRight: 4,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  icon: {
    width: 32,
    height: 32,
    resizeMode: "contain"
  },
  text: {
    flex: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chevron: {
    width: 24,
    height: 24,
    resizeMode: "contain",
    opacity: 0.65
  }
})

/* === INDEXVIEW === */

export function IndexView({ageGate}) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);  

  function dailyPlayACB() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push("/gameplay");
  }

  // function showLeaderboardACB() {
  //   setShowLeaderboard(true);
  // }

  function loginACB() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowLogin(true);
  }
  

  function handleAuthStateChangeACB(user) {
    setUser(user);
    if (initializing) setInitializing(false);
  }

  useEffect(() => {
    const subscriber = authObserverCB(handleAuthStateChangeACB);
    return () => subscriber(); // unsubscribe on unmount
  }, []);

  if (initializing) {
    return <Text style={{fontFamily: "InterVariable"}}>Loading...</Text>;
  }


  const isLoggedIn = !!user;

  return (
    <View style={Style.body}>

      {/* Title */}
      <View style={{alignItems: "center"}}>
        <View style={{marginVertical: 20, width: "40%", aspectRatio: 1}}>
          <DokubolagetLogo width="100%" height="100%" />
        </View>
        <Text style={{fontFamily: "BolagetMediumCondensed", fontSize: 20}}>Welcome to</Text>
        <Text style={{fontFamily: "Monopol", fontSize: 40}}>Dokubolaget</Text>
      </View>

      {/* Index menu */}
      <View style={{width: "100%", gap: 10, marginBottom: 80}}>
        <IndexOption
          Icon={Drinks}
          text="Daily play!"
          onPress={dailyPlayACB}
        />

        {/* Login conditional rendering */}
        {!isLoggedIn ? (
          <IndexOption
            Icon={Smakprofil}
            text="Login / Sign up"
            onPress={loginACB}
          />
        ) : (
          <View style={{gap: 5}}>
            <Text style={{fontFamily: "InterVariable"}}>Logged in as {user?.email || "Firebase user"}</Text>
            <IndexOption
              Icon={Smakprofil}
              text="Logout"
              onPress={handleLogoutACB}
            />
          </View>
        )}
      </View>
      {/* Login dialog */}
      <AuthDialog 
        open={showLogin}
        onOpenChange={setShowLogin}
      />

      {/* Age verification dialog-component */}
      <AgeVerificationDialog
        isOpen={ageGate.isOpen}
        // isOpen={true} // <-- Debug
        onAccept={ageGate.acceptAgeACB}
        onReject={ageGate.rejectAgeACB}
      />
    </View>
  );
}

export const style = StyleSheet.create({
  button: {
    borderWidth: 5,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginVertical: 10,
    backgroundColor: "#0B634B",
    borderColor: "#FFD400",
    borderRadius: 8,
    minWidth: 240,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
        width: 2,
        height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
},
    buttonText:{
        color: "#FFD700",
        fontFamily: "Monopol",
        fontSize: 28,
        fontWeight: "900",
    },

});

/* === AGE VERIFICATION === */

interface AgeVerificationDialogProps {
  isOpen: boolean;
  onAccept: () => void;
  onReject: () => void;
}

function AgeVerificationDialog({
  isOpen,
  onAccept,
  onReject,
}: AgeVerificationDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog modal open>
      <Dialog.Portal>
        <Dialog.Overlay style={age.overlay}/>
        <Dialog.Content style={age.content}>
          <DokubolagetLogo width={72} height={42}/>
          <Text style={age.title}>
            Hello, can we ask for ID?
          </Text>
          <View style={age.divider}/>
          <Text style={age.bodyText}>
            In the eyes of many, we are very age-obsessed.
            And we can only agree. Asking for ID is part of
            our work to protect young people from alcohol.
            {"\n\n"}
            This website contains information about alcohol.
            To visit it or shop, you must be 20 years of
            age or older.
          </Text>
          <View style={age.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                age.button,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={onReject}
              accessibilityRole="button"
              accessibilityLabel="I am under 20"
            >
              <Text style={age.buttonText}>I am under 20</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                age.button,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={onAccept}
              accessibilityRole="button"
              accessibilityLabel="I have turned 20"
            >
              <Text style={age.buttonText}>I have turned 20</Text>
            </Pressable>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

const age = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#c7e5ce",
    opacity: 0.4, // Unsure whether to keep
  },
  content: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    maxWidth: 320,
    padding: 30,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontFamily: "Monopol",
    fontSize: 28,
    textAlign: "center",
    color: "#262626",
  },
  divider: {
    height: 1,
    width: 56,
    backgroundColor: "#000000",
  },
  bodyText: {
    fontFamily: "InterVariable",
    fontSize: 14,
    lineHeight: 20,
    flexWrap: "wrap",
    color: "#262626",
  },
  buttonRow: {
    gap: 12,
    paddingTop: 16,
    width: "100%",
    alignItems: "stretch",
  },
  button: {
    width: "100%",
    backgroundColor: "#c7e5ce",
    borderRadius: 999,  // <-- Guarantee round
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontFamily: "InterVariable",
    fontWeight: "600",
    fontSize: 16,
    color: "#0a6149",
  },
})
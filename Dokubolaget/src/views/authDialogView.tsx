import { useState } from "react";
import { Text, Pressable } from "react-native";
import { Dialog, Input, YStack } from "tamagui";
import * as Haptics from "expo-haptics";

import {
 handleLoginACB
} from "../reactjs/authPresenter";

type Props = {
 open: boolean;
 onOpenChange: (open:boolean)=>void;
};

export default function AuthDialog({
 open,
 onOpenChange,
}: Props) {

 const [isSignUp, setIsSignUp] = useState(false);
 const [email, setEmail] = useState("");
 const [nickname, setNickname] = useState("");
 const [password, setPassword] = useState("");
 const [error, setError] = useState("");
 const [loading, setLoading] = useState(false);

 async function loginACB() {

   setLoading(true);
   setError("");

   try {

     await handleLoginACB(
       email,
       password,
       isSignUp,
       nickname
     );

     onOpenChange(false);

     setEmail("");
     setPassword("");
     setNickname("");
     setIsSignUp(false);

   } catch (error:any) {

     setError(error.message);

   } finally {

     setLoading(false);
   }
 }

function toggleSignUpACB() {
  setIsSignUp(!isSignUp);
}

function closeACB() {
  onOpenChange(false);
}

 return (
   <Dialog
      open={open}
      onOpenChange={onOpenChange}
   >
     <Dialog.Portal>

       <Dialog.Overlay
         opacity={0.5}
         bg="black"
       />

       <Dialog.Content
         width={300}
         style={{
           borderWidth:1,
           borderColor:"#ddd",
           borderRadius:16,
           backgroundColor:"#fff"
         }}
       >
         <YStack gap="$3">

           <Dialog.Title>
             {isSignUp ? "Sign Up" : "Login"}
           </Dialog.Title>

           {isSignUp && (
             <Input
               placeholder="Nickname (shown on the leaderboard)"
               value={nickname}
               onChangeText={setNickname}
               autoCapitalize="none"
               maxLength={24}
             />
           )}

           <Input
             placeholder="Email"
             value={email}
             onChangeText={setEmail}
             autoCapitalize="none"
           />

           <Input
             placeholder="Password"
             type="password"
             value={password}
             onChangeText={setPassword}
             secureTextEntry
           />

           {!!error && (
             <Text>{error}</Text>
           )}

           <Pressable
             onPress={loginACB}
             disabled={loading}
           >
             <Text>
               {loading
                 ? "Loading..."
                 : isSignUp
                   ? "Sign Up"
                   : "Login"
               }
             </Text>
           </Pressable>

           <Pressable
             onPress={toggleSignUpACB}
           >
             <Text>
              {isSignUp
                ? "Already have account? Login"
                : "Need account? Sign Up"
              }
             </Text>
           </Pressable>

           <Pressable
             onPress={closeACB}
           >
             <Text>Close</Text>
           </Pressable>

         </YStack>
       </Dialog.Content>

     </Dialog.Portal>
   </Dialog>
 );
}

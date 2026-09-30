import { StyleSheet } from "react-native"

export const Style = StyleSheet.create({
    body: {
        flexDirection: "column",
        alignItems: "center",
        padding: 16,
        width: "100%",
        height: "100%",
        justifyContent: "center",
        gap: 10,
        backgroundColor: "#f3f3f1"
    },
    cellCard: {
        flex: 1,
        flexDirection: "column",
        width: "100%",
        rowGap: 3,
        borderRadius: 3,
        backgroundColor: "#ffffff",
        padding: 5,
        borderWidth: 1,
    },
    cellImage: {
        flex: 1,
        resizeMode: "contain",
    },
    button: {
        width: "100%",
        padding: 5,
        backgroundColor: "#ffffff",
        flexDirection: "row",
        gap: 5,
        height: 35,
    }
})
import { useEffect, useState } from "react"
import { Image, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, FlatList, useWindowDimensions } from "react-native"
import Svg, { SvgUri, Path } from 'react-native-svg'
import { Style } from "../AppStyles"
import { categories } from "../categories"
import * as Haptics from "expo-haptics"
import { formatTagLabel } from "../tagDisplay"
import { Dossier, redactionKeysForTags } from "../components/Dossier"

const SEARCH_PLACEHOLDER_IMAGE = "https://www.systembolaget.se/_next/static/media/placeholder-wine-bottle.30edbfb9.png"

export type SearchResultItem = {
	id: string
	name: string
	producer: string
	country: string
	image?: string | null
	raw?: any
}

type BoardTag = {
	id: string
	label: string
	family: string
}

type SearchViewProps = {
	selectedCell: number | null
	query: string
	isLoading: boolean
	errorMessage: string | null
	results: SearchResultItem[]
	onQueryChange: (text: string) => void
	onSearch: () => void
	onResultPress: (result: SearchResultItem) => void
	onClose: () => void
	topCategories: BoardTag[]
	sideCategories: BoardTag[]
}

type SearchResultRowProps = {
	result: SearchResultItem
	onPress: (result: SearchResultItem) => void
	onPeek: (result: SearchResultItem | null, pinned: boolean) => void
}

function SearchResultRow(props: Readonly<SearchResultRowProps>) {
	const { result, onPress, onPeek } = props
	const [imageUri, setImageUri] = useState(result.image || SEARCH_PLACEHOLDER_IMAGE)

	useEffect(() => {
		setImageUri(result.image || SEARCH_PLACEHOLDER_IMAGE)
	}, [result.id, result.image])

	// Format price helper function
	function formatPrice(price: number): string {
		const hasDecimals = price % 1 !== 0
		const decimals = hasDecimals ? 2 : 0
		const [integer, fraction] = price.toFixed(decimals).split(".")
		const spacedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
		return hasDecimals ? `${spacedInteger}:${fraction}` : spacedInteger
	}

	function onPressACB() {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
		onPress(result)
	}

	return (
		<Pressable
			key={result.id}
			style={({ hovered }: any) => [row.resultItem, hovered ? row.resultItemHovered : null]}
			onPress={onPressACB}
			onHoverIn={() => onPeek(result, false)}
			onHoverOut={() => onPeek(null, false)}
			onLongPress={() => {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
				// The on-screen keyboard would cover half the case file.
				Keyboard.dismiss()
				onPeek(result, true)
			}}
			delayLongPress={380}
		>
			<Image
				source={{ uri: imageUri }}
				style={row.image}
				onError={() => setImageUri(SEARCH_PLACEHOLDER_IMAGE)}
			/>
			<View style={row.resultTextWrap}>
				{/* TODO: Determine how to render multiple categories? */}
				<Text style={row.category} >{result.raw.categoryLevel3}</Text>
				<Text style={row.name}>{result.raw.productNameBold}</Text>
				<Text style={row.nameThin}>{result.raw.productNameThin}</Text>
				<View style={{flexDirection:'row', justifyContent: "space-between"}}>
					<View style={row.metaRow}>
						{/* <SvgUri
							width={20}
							height={12}
							uri={"https://yourserver.com/flags.sprite.svg#"+result.country}
							role="img"
							accessibilityLabel={"Flagga " + result.country}
						/> */}
						<Text style={row.metaText}>{result.country}</Text>
						<Text style={row.metaText}>{result.raw.volumeText}</Text>
						<Text style={row.metaText}>{result.raw.alcoholPercentage} % vol.</Text>
					</View>
					<Text style={row.price}>{formatPrice(result.raw.price)}</Text>
				</View>
			</View>
		</Pressable>
	)
}

const row = StyleSheet.create({
	resultItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
		backgroundColor: "#fff",
		gap: 12,
		borderRadius: 5,
		marginVertical: 8
	},
	resultItemHovered: {
		backgroundColor: "#fbfaf4",
		borderBottomColor: "#cbb98f",
	},
	image: {
		width: 53,
		height: 104,
		resizeMode: "contain",
	},
	resultTextWrap: {
		flex: 1,
		gap: 3,
	},
	category: {
		fontFamily: "BolagetMediumCondensed",
		fontSize: 14,
		textTransform: "uppercase",
		letterSpacing: 0.5
	},
	name: {
		fontFamily: "Monopol",
		fontSize: 20,
		color: "#111",
	},
	nameThin: {
		fontFamily: "Monopol",
		fontSize: 20,
		color: "#676767"
	},
	metaRow: {
		flex: 1,
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 6,
		marginTop: 4,
	},
	metaText: {
		fontFamily: "InterVariable",
		fontSize: 14,
		color: "#111",
	},
	price: {
		fontFamily: "InterVariable",
		fontSize: 14,
		fontWeight: "600",
		color: "#111",
		alignSelf:	"flex-end",
		flexShrink: 0,
	},
})

export function SearchView(props: Readonly<SearchViewProps>) {
	const {
		selectedCell,
		query,
		isLoading,
		errorMessage,
		results,
		onQueryChange,
		onSearch,
		onResultPress,
		onClose,
		topCategories,
		sideCategories,
	} = props

	function keyExtractorCB(item: any) { return item.id }

	const { width: windowWidth } = useWindowDimensions()
	// Wide screens show the case file beside the panel on hover; narrow
	// screens open it over the panel on long-press.
	const sideBySide = windowWidth >= 900
	const [peek, setPeek] = useState<{ result: SearchResultItem; pinned: boolean } | null>(null)

	function onPeekACB(result: SearchResultItem | null, pinned: boolean) {
		if (!result) {
			setPeek((current) => (current?.pinned ? current : null))
			return
		}
		setPeek({ result, pinned })
	}

	function searchResultRowRenderCB ({item}: any) { return <SearchResultRow result={item} onPress={onResultPress} onPeek={onPeekACB}/> }

	function getCategoryLabels(): { row: string; col: string } | null {
		if (selectedCell === null || selectedCell < 1 || selectedCell > 9) {
			return null
		}
		const row = Math.floor((selectedCell - 1) / 3)
		const col = (selectedCell - 1) % 3
		return {
			row: formatTagLabel(sideCategories[row]),
			col: formatTagLabel(topCategories[col]),
		}
	}

	const categoryLabels = getCategoryLabels()

	const cellTags =
		selectedCell != null && selectedCell >= 1 && selectedCell <= 9
			? [sideCategories[Math.floor((selectedCell - 1) / 3)], topCategories[(selectedCell - 1) % 3]]
			: []
	const redactKeys = redactionKeysForTags(cellTags)
	const peekHint = Platform.OS === "web" && sideBySide
		? "Hover a result to open its case file"
		: "Long-press a result to open its case file"

	return (
		<View style={search.overlay}>
			<Pressable style={search.backdrop} onPress={onClose} />
			<View style={search.body}>
				<Text style={search.rubric}>Make your guess</Text>
				{categoryLabels && (
					<Text style={search.status}>{categoryLabels.row} / {categoryLabels.col}</Text>
				)}

				<View style={search.searchContainer}>
					{/* TODO: Switch to saved icon? */}
					<View style={search.inputContainer}>
						<Svg width={18} height={18} viewBox="0 0 24 24">
							<Path
								fillRule="evenodd"
								clipRule="evenodd"
								d="M14.8572 16.3572C13.5105 17.3877 11.8267 18 10 18C5.58172 18 2 14.4183 2 10C2 5.58172 5.58172 2 10 2C14.4183 2 18 5.58172 18 10C18 11.8267 17.3877 13.5105 16.3572 14.8572L22 20.5L20.5 22L14.8572 16.3572ZM16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10C4 6.68629 6.68629 4 10 4C13.3137 4 16 6.68629 16 10Z"
								fill="#333"
							/>
						</Svg>
						<TextInput
							style={search.input}
							value={query}
							onChangeText={onQueryChange}
							placeholder="What are you looking for?"
							autoFocus
						/>
					</View>
					<Pressable style={search.closeButton} onPress={onClose}>
						<Svg width={18} height={18} viewBox="0 0 24 24">
							<Path
								d="M6.4 19L5 17.6L10.6 12L5 6.4L6.4 5L12 10.6L17.6 5L19 6.4L13.4 12L19 17.6L17.6 19L12 13.4L6.4 19Z"
								fill="#333"
							/>
						</Svg>
					</Pressable>	
				</View>

				{isLoading ? <Text style={search.status}>Searching...</Text> : null}
				{!isLoading && results.length == 0 ? <Text style={search.status}>No results</Text> : null}
				{errorMessage ? <Text style={search.status}>{errorMessage}</Text> : null}
				{results.length > 0 ? <Text style={search.hint}>{peekHint}</Text> : null}
				{results.length > 0 ? (
					<View style={search.resultContainer}>
						<FlatList
							style={search.resultList}
							showsVerticalScrollIndicator={false}
							data={results.slice(0,20)}
							keyExtractor={keyExtractorCB}
							renderItem={searchResultRowRenderCB}
						/>
					</View>
				) : null}

				{peek && !sideBySide ? (
					<Pressable style={search.peekBackdrop} onPress={() => setPeek(null)}>
						<Dossier product={peek.result.raw} redact={redactKeys} width={Math.min(320, windowWidth - 48)} />
						<Text style={search.peekDismiss}>Tap anywhere to close</Text>
					</Pressable>
				) : null}
			</View>

			{peek && sideBySide ? (
				<View pointerEvents="none" style={[search.peekSide, { left: windowWidth / 2 + 250 + 20 }]}>
					<Dossier product={peek.result.raw} redact={redactKeys} />
				</View>
			) : null}
		</View>
	)
}

const search = StyleSheet.create({
	overlay: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 5,
		paddingTop: 50,
		paddingBottom: 30,
	},
	backdrop: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		backgroundColor: "rgba(0, 0, 0, 0.35)",
	},
	body: {
		flex: 1,
		width: "100%",
		maxWidth: 500,
		padding: 15,
		gap: 8,
		backgroundColor: "#f3f3f1",
		borderRadius: 20
	},
	rubric: {
		fontFamily: "Monopol",
		fontSize: 26,
		textAlign: "center"
	},
	searchContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
	},
	inputContainer: {
		flex: 1,
		flexDirection: "row",
		columnGap: 8,
		height: 36,
		borderRadius: 18,
		borderColor: "#fff",
		backgroundColor:"#fff",
		padding: 8,
		paddingLeft: 10
	},
	input: {
		fontFamily: "InterVariable",
		flex: 1,
		fontSize: 16,
		padding: 0,
		margin: 0,
		includeFontPadding: false,
		color: "#262626",

	},
	closeButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "#fff",
		alignItems: "center",
		justifyContent: "center",
	},
	resultContainer: {
		flex: 1,
		flexShrink: 1,
		borderRadius: 18
	},
	resultList: {
		gap: 20,
		overflow: "hidden"
	},
	hint: {
		fontFamily: "InterVariable",
		fontSize: 12,
		color: "#8a7a55",
		textAlign: "center",
	},
	peekBackdrop: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		borderRadius: 20,
		backgroundColor: "rgba(0, 0, 0, 0.45)",
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
		zIndex: 20,
	},
	peekDismiss: {
		fontFamily: "InterVariable",
		fontSize: 13,
		color: "#fff",
	},
	peekSide: {
		position: "absolute",
		top: 110,
	},
	status: {
		fontFamily: "Monopol",
		fontSize: 16,
		color: "#262626",
		textAlign: "center",
		padding: 5,
	},
})
import { useEffect, useState } from "react"
import { Image, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, FlatList, useWindowDimensions } from "react-native"
import Svg, { SvgUri, Path } from 'react-native-svg'
import { categories } from "../categories"
import { haptics } from "../theme/haptics";
import { formatTagLabel } from "../tagDisplay"
import { Dossier, redactionKeysForTags } from "../components/Dossier"
import { useTheme, useThemedStyles } from "../theme/ThemeProvider"
import type { Theme } from "../theme/types"
import { formatKronor, groupResultsByType, rowFields, type GroupHeader, type RowField } from "../searchHelpers"

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
	// Products already guessed wrong for this cell.
	rejectedIds: string[]
	// The last wrong guess, shown above the results.
	feedback: { kind: "near" | "miss"; text: string } | null
}

type SearchResultRowProps = {
	result: SearchResultItem
	tried: boolean
	// Facts this cell asks about (from the info-sheet redaction rules).
	redact: ReadonlySet<string>
	onPress: (result: SearchResultItem) => void
	onPeek: (result: SearchResultItem | null, pinned: boolean) => void
}

function SearchResultRow(props: Readonly<SearchResultRowProps>) {
	const { result, tried, redact, onPress, onPeek } = props
	const { theme } = useTheme()
	const row = useThemedStyles(makeRowStyles)
	const [imageUri, setImageUri] = useState(result.image || SEARCH_PLACEHOLDER_IMAGE)

	useEffect(() => {
		setImageUri(result.image || SEARCH_PLACEHOLDER_IMAGE)
	}, [result.id, result.image])

	function onPressACB() {
		haptics.play("tap")
		onPress(result)
	}

	// The facts this cell asks about are blacked out, so the answer has to come
	// from the player, not the result row.
	const fields = Object.fromEntries(rowFields(result.raw, redact).map((field) => [field.key, field])) as Partial<Record<RowField["key"], RowField>>
	const masked = (field: RowField | undefined, style: any, suffix = "") =>
		field ? (
			field.hidden ? (
				<Text style={[style, row.bar]} accessibilityLabel="hidden">{"x".repeat(Math.max(3, Math.min(field.length, 12)))}</Text>
			) : (
				<Text style={style}>{field.text}{suffix}</Text>
			)
		) : null
	const triedLabel = theme.id === "prislista" ? "REDAN PRÖVAD" : "TRIED"

	return (
		<Pressable
			key={result.id}
			style={({ hovered }: any) => [row.resultItem, hovered ? row.resultItemHovered : null]}
			onPress={onPressACB}
			onHoverIn={() => onPeek(result, false)}
			onHoverOut={() => onPeek(null, false)}
			onLongPress={() => {
				haptics.play("tap")
				// The on-screen keyboard would cover half the case file.
				Keyboard.dismiss()
				onPeek(result, true)
			}}
			delayLongPress={380}
			accessibilityRole="button"
			accessibilityLabel={`${result.raw?.productNameBold ?? result.name}${tried ? ", already tried" : ""}`}
		>
			{theme.flags.dottedLeaderPrices ? (
				<View style={row.resultTextWrap}>
					<View style={row.leaderLine}>
						<Text style={row.leaderNumber} numberOfLines={1}>{result.raw?.productNumber}</Text>
						<Text style={row.leaderName} numberOfLines={1}>{result.raw?.productNameBold ?? result.name}</Text>
						<View style={row.leaderDots} />
						{masked(fields.price, row.leaderPrice, ":-")}
					</View>
					<View style={row.leaderSubRow}>
						{(["type", "country", "volume", "strength"] as const)
							.filter((key) => fields[key])
							.map((key, index) => (
								<View key={key} style={row.leaderSubItem}>
									{index > 0 ? <Text style={row.leaderSub}>·</Text> : null}
									{masked(fields[key], row.leaderSub)}
								</View>
							))}
					</View>
				</View>
			) : (
				<>
					<Image
						source={{ uri: imageUri }}
						style={row.image}
						onError={() => setImageUri(SEARCH_PLACEHOLDER_IMAGE)}
					/>
					<View style={row.resultTextWrap}>
						{masked(fields.type, row.category)}
						<Text style={row.name}>{result.raw?.productNameBold}</Text>
						<Text style={row.nameThin}>{result.raw?.productNameThin}</Text>
						<View style={{flexDirection:'row', justifyContent: "space-between"}}>
							<View style={row.metaRow}>
								{masked(fields.country, row.metaText)}
								{masked(fields.volume, row.metaText)}
								{masked(fields.strength, row.metaText, " vol.")}
							</View>
							{masked(fields.price, row.price)}
						</View>
					</View>
				</>
			)}
			{tried ? (
				<View pointerEvents="none" style={row.tried}>
					<Text style={row.triedText}>{triedLabel}</Text>
				</View>
			) : null}
		</Pressable>
	)
}

const makeRowStyles = (theme: Theme) => ({
	resultItem: {
		flexDirection: "row" as const,
		alignItems: "center" as const,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: theme.colors.divider,
		backgroundColor: theme.flags.dottedLeaderPrices ? "transparent" : theme.colors.surface,
		gap: 12,
		borderRadius: Math.min(5, theme.radii.card),
		marginVertical: theme.flags.dottedLeaderPrices ? 0 : 8,
	},
	resultItemHovered: {
		backgroundColor: theme.colors.surfaceAlt,
		borderBottomColor: theme.colors.highlight,
	},
	image: {
		width: 53,
		height: 104,
		resizeMode: "contain" as const,
	},
	resultTextWrap: {
		flex: 1,
		gap: 3,
	},
	category: {
		fontFamily: theme.fonts.condensed,
		fontSize: 14,
		color: theme.colors.ink,
		textTransform: "uppercase" as const,
		letterSpacing: 0.5,
	},
	name: {
		fontFamily: theme.fonts.display,
		fontSize: 20,
		color: theme.colors.inkStrong,
	},
	nameThin: {
		fontFamily: theme.fonts.display,
		fontSize: 20,
		color: theme.colors.inkMuted,
	},
	metaRow: {
		flex: 1,
		flexDirection: "row" as const,
		flexWrap: "wrap" as const,
		gap: 6,
		marginTop: 4,
	},
	metaText: {
		fontFamily: theme.fonts.body,
		fontSize: 14,
		color: theme.colors.inkStrong,
	},
	price: {
		fontFamily: theme.fonts.bodyStrong,
		fontSize: 14,
		fontWeight: "600" as const,
		color: theme.colors.inkStrong,
		alignSelf: "flex-end" as const,
		flexShrink: 0,
	},
	leaderLine: {
		flexDirection: "row" as const,
		alignItems: "flex-end" as const,
	},
	leaderNumber: {
		fontFamily: theme.fonts.mono,
		fontSize: 12,
		width: 62,
		color: theme.colors.ink,
	},
	leaderName: {
		fontFamily: theme.fonts.display,
		fontSize: 15,
		color: theme.colors.ink,
		flexShrink: 1,
	},
	leaderDots: {
		flex: 1,
		minWidth: 16,
		borderBottomWidth: 2,
		borderStyle: "dotted" as const,
		borderColor: theme.colors.ink,
		marginHorizontal: 6,
		marginBottom: 5,
	},
	leaderPrice: {
		fontFamily: theme.fonts.mono,
		fontSize: 14,
		fontWeight: "600" as const,
		color: theme.colors.ink,
	},
	leaderSubRow: {
		marginLeft: 62,
		flexDirection: "row" as const,
		flexWrap: "wrap" as const,
		alignItems: "center" as const,
	},
	leaderSubItem: {
		flexDirection: "row" as const,
		alignItems: "center" as const,
		gap: 4,
		marginRight: 4,
	},
	// A blacked-out fact: same ink as background, so nothing shows through.
	bar: {
		color: theme.dossier.bar,
		backgroundColor: theme.dossier.bar,
		alignSelf: "flex-start" as const,
	},
	leaderSub: {
		fontFamily: theme.fonts.mono,
		fontSize: 11,
		color: theme.colors.inkMuted,
	},
	tried: {
		position: "absolute" as const,
		right: 10,
		top: 8,
		borderWidth: 1.5,
		borderColor: theme.colors.miss,
		borderRadius: theme.radii.pill,
		paddingHorizontal: 6,
		paddingVertical: 1,
		transform: [{ rotate: "-6deg" }],
		backgroundColor: theme.colors.missBg,
	},
	triedText: {
		fontFamily: theme.fonts.condensed,
		fontSize: 11,
		letterSpacing: 1,
		color: theme.colors.miss,
	},
});

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
		rejectedIds,
		feedback,
	} = props
	const { theme, copy } = useTheme()
	const search = useThemedStyles(makeSearchStyles)

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

	function cellTagsForGrouping() {
		return selectedCell != null && selectedCell >= 1 && selectedCell <= 9
			? [sideCategories[Math.floor((selectedCell - 1) / 3)], topCategories[(selectedCell - 1) % 3]]
			: []
	}

	function searchResultRowRenderCB ({item}: { item: SearchResultItem | GroupHeader }) {
		if ("kind" in item && item.kind === "header") {
			return <Text style={search.groupHeader}>— {item.label.toUpperCase()} —</Text>
		}
		const result = item as SearchResultItem
		return <SearchResultRow result={result} tried={rejectedIds.includes(result.id)} redact={redactKeys} onPress={onResultPress} onPeek={onPeekACB}/>
	}

	const shownResults = results.slice(0, 20)
	// Grouping by type would give the answer away when the cell asks about type.
	const listData =
		theme.flags.groupResultsByType && !redactionKeysForTags(cellTagsForGrouping()).has("style")
			? groupResultsByType(shownResults)
			: shownResults

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
				<Text style={search.rubric}>{copy.searchTitle}</Text>
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
								fill={theme.colors.icon}
							/>
						</Svg>
						<TextInput
							placeholderTextColor={theme.colors.inkFaint}
							style={search.input}
							value={query}
							onChangeText={onQueryChange}
							placeholder="What are you looking for?"
							autoFocus
						/>
					</View>
					<Pressable style={search.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close search">
						<Svg width={18} height={18} viewBox="0 0 24 24">
							<Path
								d="M6.4 19L5 17.6L10.6 12L5 6.4L6.4 5L12 10.6L17.6 5L19 6.4L13.4 12L19 17.6L17.6 19L12 13.4L6.4 19Z"
								fill={theme.colors.icon}
							/>
						</Svg>
					</Pressable>	
				</View>

				{feedback ? (
					<View
						accessibilityLiveRegion="polite"
						accessibilityRole="alert"
						style={[
							search.feedback,
							{
								backgroundColor: feedback.kind === "near" ? theme.colors.nearMissBg : theme.colors.missBg,
								borderColor: feedback.kind === "near" ? theme.colors.nearMiss : theme.colors.miss,
							},
						]}
					>
						<Text style={[search.feedbackText, { color: feedback.kind === "near" ? theme.colors.nearMiss : theme.colors.miss }]}>
							{feedback.text}
						</Text>
					</View>
				) : null}
				{isLoading ? <Text style={search.status}>Searching...</Text> : null}
				{!isLoading && results.length == 0 ? <Text style={search.status}>No results</Text> : null}
				{errorMessage ? <Text style={search.status}>{errorMessage}</Text> : null}
				{results.length > 0 ? <Text style={search.hint}>{peekHint}</Text> : null}
				{results.length > 0 ? (
					<View style={search.resultContainer}>
						<FlatList
							style={search.resultList}
							showsVerticalScrollIndicator={false}
							data={listData}
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

const makeSearchStyles = (theme: Theme) => ({
	overlay: {
		flex: 1,
		justifyContent: "center" as const,
		alignItems: "center" as const,
		padding: 5,
		paddingTop: 50,
		paddingBottom: 30,
	},
	backdrop: {
		position: "absolute" as const,
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		backgroundColor: theme.colors.overlay,
	},
	body: {
		flex: 1,
		width: "100%" as const,
		maxWidth: 500,
		padding: 15,
		gap: 8,
		backgroundColor: theme.colors.page,
		borderRadius: Math.min(20, theme.radii.card + 2),
		borderWidth: theme.flags.ruledTable ? theme.borders.card : 0,
		borderColor: theme.colors.ink
	},
	rubric: {
		fontFamily: theme.fonts.display,
		fontSize: 26,
		color: theme.colors.inkStrong,
		textAlign: "center" as const
	},
	searchContainer: {
		flexDirection: "row" as const,
		alignItems: "center" as const,
		gap: 5,
	},
	inputContainer: {
		flex: 1,
		flexDirection: "row" as const,
		columnGap: 8,
		height: 36,
		borderRadius: 18,
		borderColor: theme.colors.divider,
		backgroundColor: theme.colors.surface,
		padding: 8,
		paddingLeft: 10
	},
	input: {
		fontFamily: theme.fonts.body,
		flex: 1,
		fontSize: 16,
		padding: 0,
		margin: 0,
		includeFontPadding: false,
		color: theme.colors.ink,
	},
	closeButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: theme.colors.surface,
		alignItems: "center" as const,
		justifyContent: "center" as const,
	},
	resultContainer: {
		flex: 1,
		flexShrink: 1,
		borderRadius: 18
	},
	resultList: {
		gap: 20,
		overflow: "hidden" as const
	},
	hint: {
		fontFamily: theme.fonts.body,
		fontSize: 12,
		color: theme.colors.hint,
		textAlign: "center" as const,
	},
	peekBackdrop: {
		position: "absolute" as const,
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		borderRadius: 20,
		backgroundColor: theme.colors.overlay,
		alignItems: "center" as const,
		justifyContent: "center" as const,
		gap: 12,
		zIndex: 20,
	},
	peekDismiss: {
		fontFamily: theme.fonts.body,
		fontSize: 13,
		color: "#ffffff",
	},
	peekSide: {
		position: "absolute" as const,
		top: 110,
	},
	status: {
		fontFamily: theme.fonts.display,
		fontSize: 16,
		color: theme.colors.ink,
		textAlign: "center" as const,
		padding: 5,
	},
	feedback: {
		borderWidth: 1.5,
		borderRadius: Math.min(12, theme.radii.card),
		paddingVertical: 8,
		paddingHorizontal: 12,
	},
	feedbackText: {
		fontFamily: theme.fonts.bodyStrong,
		fontSize: 14,
		textAlign: "center" as const,
	},
	groupHeader: {
		fontFamily: theme.fonts.display,
		fontSize: 13,
		letterSpacing: 4,
		textAlign: "center" as const,
		color: theme.colors.inkMuted,
		marginTop: 14,
		marginBottom: 4,
	},
})

import { observer } from "mobx-react-lite"
import { router } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { Vibration } from "react-native"
import { SearchView, type SearchResultItem } from "../views/searchView"
import * as Haptics from "expo-haptics"
import { useTheme } from "../theme/ThemeProvider"
import { composeFeedbackText } from "../theme/feedbackText"

const Search = observer(function SearchRender(props: any) {
	const { model, cellParam } = props

	const selectedCell = useMemo(() => {
		if (cellParam !== undefined) {
			const asNumber = Number(cellParam)
			return Number.isNaN(asNumber) ? model.currentCell : asNumber
		}
		return model.currentCell
	}, [cellParam, model.currentCell])

	const [query, setQuery] = useState(model.searchParams.query ?? "")
	const { copy } = useTheme()
	// Feedback for the last wrong guess, shown inside the search panel so the
	// player can try again without retyping.
	const [inlineFeedback, setInlineFeedback] = useState<{ kind: "near" | "miss"; text: string } | null>(null)

	function clearSearchState() {
		setQuery("")
		model.setSearchQuery("")
		model.doSearch({ query: "", cell: selectedCell })
	}

	function onQueryChange(text: string) {
		setQuery(text)
		model.setSearchQuery(text)
	}

	function onSearch() {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
		const trimmedQuery = query.trim()
		if (trimmedQuery.length === 0) {
			model.doSearch({ query: "", cell: selectedCell })
			return
		}

		if (trimmedQuery.length < 3) {
			return
		}

		model.doSearch({ query: trimmedQuery, cell: selectedCell })
	}

	function onResultPress(result: SearchResultItem) {
		if (selectedCell == null) {
			return
		}

		const validation = model.setCellResult(selectedCell, result)

		if (validation?.isValid) {
			Vibration.vibrate([0, 100, 50, 100])
			setInlineFeedback(null)
			clearSearchState()
			router.back()
			return
		}

		// Wrong guess: stay in search with the query kept, so a retry is one tap.
		Vibration.vibrate([0, 50, 100, 50])
		const kind = validation?.kind === "near" ? "near" : "miss"
		setInlineFeedback({ kind, text: composeFeedbackText({ kind, message: String(validation?.reason ?? "") }, copy) })
	}

	function onClose() {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
		setInlineFeedback(null)
		clearSearchState()
		router.back()
	}

	useEffect(() => {
		const trimmedQuery = query.trim()
		if (trimmedQuery.length === 0) {
			model.doSearch({ query: "", cell: selectedCell })
			return
		}

		if (trimmedQuery.length < 3) {
			return
		}

		const debounceTimer = setTimeout(() => {
			model.doSearch({ query: trimmedQuery, cell: selectedCell })
		}, 250)

		return () => clearTimeout(debounceTimer)

	}, [query, selectedCell, model])

	return (
		<SearchView
			selectedCell={selectedCell}
			query={query}
			isLoading={Boolean(model.searchResultsPromiseState.promise) && !model.searchResultsPromiseState.data && !model.searchResultsPromiseState.error}
			errorMessage={
				model.searchResultsPromiseState.error
					? "Could not search right now."
					: null
			}
			results={model.searchResultsPromiseState.data ?? []}
			rejectedIds={model.rejectedByCell?.[selectedCell] || []}
			onResultPress={onResultPress}
			feedback={inlineFeedback}
			onQueryChange={onQueryChange}
			onSearch={onSearch}
			onClose={onClose}
			topCategories={model.topCategories}
			sideCategories={model.sideCategories}
		/>
	)
})

export default Search
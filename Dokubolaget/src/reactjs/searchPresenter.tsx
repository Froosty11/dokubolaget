import { observer } from "mobx-react-lite"
import { router } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { Vibration } from "react-native"
import { SearchView, type SearchResultItem } from "../views/searchView"
import * as Haptics from "expo-haptics"

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
		} else {
			Vibration.vibrate([0, 50, 100, 50])
		}

		clearSearchState()
		router.back()
	}

	function onClose() {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
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
			onResultPress={onResultPress}
			onQueryChange={onQueryChange}
			onSearch={onSearch}
			onClose={onClose}
			topCategories={model.topCategories}
			sideCategories={model.sideCategories}
		/>
	)
})

export default Search
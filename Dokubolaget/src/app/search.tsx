import { useLocalSearchParams } from "expo-router";
import { reactiveModel } from "../mobxReactiveModel";
import Search from "../reactjs/searchPresenter";

export default function SearchPage() {
  const params = useLocalSearchParams();
  const cellParam = Array.isArray(params.cell) ? params.cell[0] : params.cell;

  return <Search model={reactiveModel} cellParam={cellParam} />;
}

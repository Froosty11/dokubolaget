import { reactiveModel } from "../mobxReactiveModel";
import { ThemePicker } from "../reactjs/themePickerPresenter";

export default function ThemesPage() {
  return <ThemePicker model={reactiveModel} />;
}

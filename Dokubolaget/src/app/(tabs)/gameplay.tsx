
import  Gameplay  from "../../reactjs/gameplayPresenter"
import { reactiveModel } from "../../mobxReactiveModel"

export default function IndexPage() {
  return (
      <Gameplay model={reactiveModel} />
  )
}

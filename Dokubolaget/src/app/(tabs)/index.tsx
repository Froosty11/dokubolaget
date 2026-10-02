
import { Index } from "../../reactjs/indexPresenter"
import { reactiveModel } from "../../mobxReactiveModel"
import "@tamagui/native/setup-zeego"

export default function IndexPage() {
  return (  
      <Index model={reactiveModel} />
  )
}

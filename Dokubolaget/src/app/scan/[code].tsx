import { useLocalSearchParams } from "expo-router";
import { ScanPresenter } from "../../reactjs/scanPresenter";

// The link in a pub's QR code: /scan/XXXX-XXXX-XX
export default function ScanPage() {
  const params = useLocalSearchParams();
  const code = String(Array.isArray(params.code) ? params.code[0] : params.code ?? "");
  return <ScanPresenter code={code} />;
}

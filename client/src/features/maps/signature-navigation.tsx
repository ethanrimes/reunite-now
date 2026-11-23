import { NavLink } from "react-router-dom";
import { t } from "../../i18n/i18n";

export function SignatureNavigation() {
  return (
    <nav className="signature-navigation" aria-label={t("Signature views")}>
      <NavLink end to="/coverage">
        {t("US map")}
      </NavLink>
      <NavLink end to="/coverage/worldwide">
        {t("World map")}
      </NavLink>
      <NavLink end to="/coverage/signatories">
        {t("Signatories")}
      </NavLink>
    </nav>
  );
}

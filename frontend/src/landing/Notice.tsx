import { FIRMS_URL, NOTICE } from "../notice";

/** The small print at the very end of the Landing: unofficial, where the data comes from, who to call. */
export default function Notice() {
  return (
    <footer className="landing-notice">
      <p>{NOTICE}</p>
      <p>
        Sumber data titik api:{" "}
        <a href={FIRMS_URL} target="_blank" rel="noreferrer">
          NASA FIRMS
        </a>
        .
      </p>
    </footer>
  );
}

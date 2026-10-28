import { PHOTO_CREDITS } from "./credits";

/** The photographs' authors, as their licences ask. */
export default function PhotoCredits() {
  return (
    <footer className="photo-credits">
      <p className="landing-label">Foto</p>
      <ul>
        {PHOTO_CREDITS.map((credit) => (
          <li key={credit.source}>
            <a href={credit.source} target="_blank" rel="noreferrer">
              {credit.subject}
            </a>
            {" · "}
            {credit.author}
            {" · "}
            {credit.licenseUrl ? (
              <a href={credit.licenseUrl} target="_blank" rel="noreferrer">
                {credit.license}
              </a>
            ) : (
              credit.license
            )}
          </li>
        ))}
      </ul>
    </footer>
  );
}

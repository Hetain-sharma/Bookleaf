import { useEffect, useState } from "react";
import api from "../services/api";

export default function PrivateBookFile({ bookId, fileType, file }) {
  const [fileUrl, setFileUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let objectUrl = "";
    let active = true;

    async function loadFile() {
      try {
        const response = await api.get(`/books/${bookId}/files/${fileType}`, {
          responseType: "blob",
        });
        objectUrl = URL.createObjectURL(response.data);
        if (active) setFileUrl(objectUrl);
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Unable to load private file.");
      }
    }

    if (file) loadFile();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bookId, fileType, file]);

  if (!file) return <p className="muted">No {fileType === "cover" ? "cover" : "manuscript"} uploaded.</p>;
  if (error) return <p className="error-message" role="alert">{error}</p>;
  if (!fileUrl) return <p>Loading private {fileType}...</p>;

  return (
    <div className="private-book-file">
      {fileType === "cover" && (
        <img className="book-cover-preview" src={fileUrl} alt={`Cover for ${file.originalName}`} />
      )}
      <a className="secondary-link" href={fileUrl} target="_blank" rel="noreferrer">
        {fileType === "cover" ? "Open cover image" : `Open ${file.originalName}`}
      </a>
    </div>
  );
}

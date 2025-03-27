import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/router";
import { FiLogOut } from "react-icons/fi";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import { Truck } from "lucide-react";

export default function Reklamacje() {
  const [selectedReklamacja, setSelectedReklamacja] = useState(null);
  const [reklamacje, setReklamacje] = useState([]);
  const [filteredReklamacje, setFilteredReklamacje] = useState([]);
  const [firmy, setFirmy] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();
  const [pdfFile, setPdfFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [pdfPreview, setPdfPreview] = useState(null); // Podgląd PDF
  const [imagePreviews, setImagePreviews] = useState(Array(4).fill(null)); // Podgląd zdjęć
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  let reklamacjaData = {};
  if (selectedReklamacja) {
    const { nr_reklamacji, ...restData } = selectedReklamacja;
    reklamacjaData = restData;
  }
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [realizacjaDate, setRealizacjaDate] = useState(new Date());
  const [newReklamacja, setNewReklamacja] = useState({
    nazwa_firmy: "",
    numer_faktury: "",
    kod_pocztowy: "",
    miejscowosc: "",
    adres: "",
    opis: "",
    informacje_od_zglaszajacego: "",
    status: "Zgłoszone",
    realizacja_do: new Date().toISOString(), // Nowe pole
  });
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [opisPrzebiegu, setOpisPrzebiegu] = useState("");
  const [closeImageFiles, setCloseImageFiles] = useState([]);
  const [closeImagePreviews, setCloseImagePreviews] = useState([]);

  function calculateRemainingTime(targetDate) {
    const currentDate = new Date();
    const diffTime = new Date(targetDate) - currentDate;
    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return remainingDays > 0 ? remainingDays : 0;
  }

  function handleImageClick(imageUrl) {
    setZoomedImage(imageUrl);
  }

  function handleClosePopup() {
    setZoomedImage(null);
  }
  function CarIcon({ trasa }) {
    return (
      <Tippy
        content={
          trasa
            ? `Przypisano do trasy: ${new Date(trasa).toLocaleDateString()}`
            : "Brak trasy"
        }
        placement="top"
      >
        <div className="flex items-center justify-center cursor-pointer">
          <Truck
            className={`w-6 h-6 ${trasa ? "text-green-500" : "text-gray-400"}`}
          />
        </div>
      </Tippy>
    );
  }
  function FileUploader({ onFileSelect, fileType, label, filePreview }) {
    const { getRootProps, getInputProps } = useDropzone({
      accept: fileType,
      maxSize: 2 * 1024 * 1024, // Maks. 2MB
      onDrop: (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (file) {
          const previewUrl = URL.createObjectURL(file); // Utwórz podgląd natychmiast
          onFileSelect(file, previewUrl); // Przekaż zarówno plik, jak i podgląd
        }
      },
    });

    return (
      <div
        {...getRootProps()}
        className="border-dashed border-2 border-gray-300 p-6 text-center cursor-pointer relative"
      >
        <input {...getInputProps()} />
        {filePreview ? (
          <div className="flex flex-col items-center">
            {fileType.includes("image") ? (
              <Image
                src={filePreview}
                alt="Podgląd"
                width={64} // Możesz dostosować szerokość
                height={64} // Możesz dostosować wysokość
                className="h-16 w-16 object-cover mb-2 rounded"
                unoptimized
              />
            ) : (
              <a
                href={filePreview}
                target="_blank"
                className="text-blue-500 underline"
              >
                PDF (Podgląd)
              </a>
            )}
            <p className="text-gray-700 text-sm truncate w-32">
              {filePreview.split("/").pop()}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-blue-500">Wgraj {label} lub przeciągnij tutaj</p>
            <p className="text-gray-500 text-sm">PNG, JPG, GIF, SVG do 2MB</p>
          </div>
        )}
      </div>
    );
  }
  async function handleFinishReklamacja() {
    try {
      const imagePaths = [];
      for (let i = 0; i < closeImageFiles.length; i++) {
        if (closeImageFiles[i]) {
          const imagePath = await uploadFile(closeImageFiles[i], "images");
          if (imagePath) imagePaths.push(imagePath);
        }
      }

      const { error } = await supabase
        .from("reklamacje")
        .update({
          status: "Zakończone",
          opis_przebiegu: opisPrzebiegu,
          zalacznik_zakonczenie: imagePaths,
        })
        .eq("id", selectedReklamacja.id);

      if (error) {
        alert(error.message);
      } else {
        alert("✅ Reklamacja została zakończona!");
        setIsCloseOpen(false);
        location.reload();
      }
    } catch (error) {
      alert(`Błąd: ${error.message}`);
    }
  }

  async function compressImage(file) {
    try {
      const options = {
        maxSizeMB: 0.5, // Maksymalny rozmiar pliku w MB (0.5 MB = 500 KB)
        maxWidthOrHeight: 1024, // Maksymalna szerokość/wysokość w px
        useWebWorker: true, // Użyj Web Workerów
      };
      const compressedFile = await imageCompression(file, options);
      console.log("Rozmiar przed kompresją:", file.size / 1024, "KB");
      console.log("Rozmiar po kompresji:", compressedFile.size / 1024, "KB");
      return compressedFile;
    } catch (error) {
      console.error("Błąd kompresji obrazu:", error);
      return file; // Jeśli kompresja się nie powiedzie, zwróć oryginał
    }
  }

  async function uploadFile(file, folder) {
    try {
      console.log("Rozpoczynanie uploadu pliku:", file.name);

      // Kompresja obrazów
      if (file.type.startsWith("image/")) {
        file = await compressImage(file);
      }

      const filePath = `${folder}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from("reklamacje")
        .upload(filePath, file);

      if (error) {
        console.error("Błąd przesyłania pliku:", error.message);
        return null;
      }

      console.log("Upload zakończony sukcesem:", data.path);
      return data.path;
    } catch (err) {
      console.error("Błąd w funkcji uploadFile:", err.message);
      return null;
    }
  }
  async function archiveOldReklamacje() {
    try {
      const currentDate = new Date();
      currentDate.setMonth(currentDate.getMonth() - 1); // Miesiąc wstecz
      const formattedDate = currentDate.toISOString();

      const { error } = await supabase
        .from("reklamacje")
        .update({ status: "Archiwum" })
        .lt("data_zakonczenia", formattedDate) // Reklamacje starsze niż miesiąc
        .eq("status", "Zakończone"); // Tylko zakończone reklamacje

      if (error) throw error;

      console.log(
        "✅ Archiwizacja zakończonych reklamacji zakończona sukcesem."
      );
    } catch (error) {
      console.error("Błąd archiwizacji reklamacji:", error.message);
    }
  }
  async function fetchReklamacje() {
    try {
      setLoading(true);
      let data;
      let error;

      if (user?.role === "admin") {
        ({ data, error } = await supabase
          .from("reklamacje")
          .select("*")
          .eq("status", "Archiwum") // Tylko archiwum
          .order("data_zgloszenia", { ascending: false }));
      } else if (user?.firma_id) {
        ({ data, error } = await supabase
          .from("reklamacje")
          .select("*")
          .eq("firma_id", user.firma_id)
          .eq("status", "Archiwum") // Tylko archiwum
          .order("data_zgloszenia", { ascending: false }));
      }

      if (error) throw error;

      setReklamacje(data || []);
      setFilteredReklamacje(data || []);
    } catch (error) {
      console.error("Błąd pobierania reklamacji:", error.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    async function loadData() {
      try {
        // Archiwizacja reklamacji przed pobraniem danych
        await archiveOldReklamacje();

        // Pobranie użytkownika
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) throw error;

        if (user) {
          const { data: userData, error: userError } = await supabase
            .from("firmy")
            .select("*")
            .eq("email", user.email)
            .single();

          if (userError) throw userError;
          setUser({
            ...user,
            role: userData.rola,
            firma_id: userData.firma_id,
          });

          // Pobranie reklamacji dopiero po uzyskaniu danych użytkownika
          let data;
          let reklError;

          if (userData.rola === "admin") {
            ({ data, reklError } = await supabase
              .from("reklamacje")
              .select("*")
              .eq("status", "Archiwum") // Tylko archiwum
              .order("data_zgloszenia", { ascending: false }));
          } else if (userData.firma_id) {
            ({ data, reklError } = await supabase
              .from("reklamacje")
              .select("*")
              .eq("firma_id", userData.firma_id)
              .eq("status", "Archiwum") // Tylko archiwum
              .order("data_zgloszenia", { ascending: false }));
          }

          if (reklError) throw reklError;

          setReklamacje(data || []);
          setFilteredReklamacje(data || []);
        }

        // Pobranie firm (niezależnie od tego, czy jest użytkownik, czy nie)
        const { data: firmyData, error: firmyError } = await supabase
          .from("firmy")
          .select("*");

        if (firmyError) throw firmyError;

        setFirmy(firmyData);
      } catch (error) {
        console.error("Błąd ładowania danych:", error.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);
  useEffect(() => {
    async function loadData() {
      try {
        // Pobranie użytkownika
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) throw error;

        if (user) {
          const { data: userData, error: userError } = await supabase
            .from("firmy")
            .select("*")
            .eq("email", user.email)
            .single();

          if (userError) throw userError;
          setUser({
            ...user,
            role: userData.rola,
            firma_id: userData.firma_id,
          });

          // Pobranie reklamacji dopiero po uzyskaniu danych użytkownika
          await fetchReklamacje();
        }

        // Pobranie firm (niezależnie od tego, czy jest użytkownik, czy nie)
        const { data: firmyData, error: firmyError } = await supabase
          .from("firmy")
          .select("*");

        if (firmyError) throw firmyError;

        setFirmy(firmyData);
      } catch (error) {
        console.error("Błąd ładowania danych:", error.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  });

  // 🔍 Wyszukiwanie i filtrowanie
  useEffect(() => {
    if (!reklamacje || reklamacje.length === 0) return;
    const filtered = reklamacje.filter(
      (r) =>
        (r.nazwa_firmy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.kod_pocztowy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.numer_faktury?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.miejscowosc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.opis?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterStatus ? r.status === filterStatus : true)
    );
    setFilteredReklamacje(filtered);
  }, [searchTerm, filterStatus, reklamacje]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }
  useEffect(() => {
    if (selectedReklamacja) {
      // Wczytywanie podglądu PDF
      if (selectedReklamacja.zalacznik_pdf) {
        setPdfPreview(
          `https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${selectedReklamacja.zalacznik_pdf}`
        );
      }

      // Wczytywanie podglądów zdjęć
      if (selectedReklamacja.zalacznik_zdjecia) {
        const previews = selectedReklamacja.zalacznik_zdjecia.map(
          (img) =>
            `https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${img}`
        );
        setImagePreviews(previews);
      }
    }
  }, [selectedReklamacja]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-gray-900 text-white py-5 px-8 flex justify-between items-center shadow-lg">
        <h1
          className="text-2xl font-bold cursor-pointer hover:text-gray-300 transition"
          onClick={() => router.push("/dashboard")}
        >
          Meblofix Sp. z o.o.
        </h1>
        <div className="relative">
          <div className="flex items-center space-x-4">
            {user && <span className="text-sm font-medium">{user.email}</span>}
            <button
              className="bg-red-500 text-white w-10 h-10 rounded-full flex items-center justify-center"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              {user?.email?.charAt(0).toUpperCase()}
            </button>
          </div>
          {dropdownOpen && (
            <div className="absolute right-0 mt-3 w-48 bg-white rounded-lg shadow-lg border p-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                <FiLogOut className="mr-2" /> Wyloguj się
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="w-full px-4 py-10">
        <h2 className="text-3xl font-bold mb-6 text-center">
          Archiwum reklamacji
        </h2>

        <div className="flex justify-center mb-4">
          <input
            type="text"
            placeholder="Wyszukaj..."
            className="border p-2 rounded w-1/3 text-gray-900"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto w-full table-container">
          <table className="table-auto w-full bg-white shadow-md rounded-lg p-5 table-responsive">
            <thead>
              <tr className="border-b">
                {/* {user?.role === "admin" && <th className="p-2 text-left"></th>} */}
                {user?.role === "admin" && (
                  <th className="p-2 text-left">Nr</th>
                )}
                <th className="p-2 text-left">Firma</th>
                <th className="p-2 text-left">Nr reklamacji</th>
                {/* <th className="p-2 text-left">Trasa</th> */}
                <th className="p-2 text-left">Kod pocztowy</th>
                <th className="p-2 text-left">Data dodania</th>
                <th className="p-2 text-left">Miejscowość</th>
                <th className="p-2 text-left">Opis</th>
                <th className="p-2 text-left">Informacje</th>
                <th className="p-2 text-left">Załączniki</th>
                <th className="p-2 text-left">Termin realizacji</th>
                <th className="p-2 text-left">Pozostały czas</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Podgląd</th>
              </tr>
            </thead>
            <tbody>
              {(filteredReklamacje || []).map((r) => (
                <tr
                  key={r.id}
                  className="border-b hover:bg-gray-200 transition"
                >
                  {/* {user?.role === "admin" && (
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedReklamacje.includes(r.id)}
                        onChange={() => handleSelectReklamacja(r.id)}
                      />
                    </td>
                  )} */}
                  {user?.role === "admin" && (
                    <td className="p-2 text-gray-900 text-xs">
                      {r.nr_reklamacji}
                    </td>
                  )}
                  <td className="p-2 text-gray-900 text-xs">{r.nazwa_firmy}</td>
                  <td className="p-2 text-gray-900 text-xs">
                    {r.numer_faktury}
                  </td>

                  {/* <td className="p-2 text-gray-900 text-xs">
                    <CarIcon trasa={r.trasa} />
                  </td> */}

                  <td className="p-2 text-gray-900 text-xs">
                    {new Date(r.data_zgloszenia).toLocaleDateString()}
                  </td>
                  <td className="p-2 text-gray-900 text-xs">
                    {r.kod_pocztowy}
                  </td>
                  <td className="p-2 text-gray-900 text-xs">{r.miejscowosc}</td>
                  <td className="p-2 text-gray-900 text-xs">
                    {r.opis.length > 25
                      ? r.opis.substring(0, 25) + "..."
                      : r.opis}
                  </td>
                  <td className="p-2 text-gray-900 text-xs">
                    {r.informacje &&
                    typeof r.informacje === "string" &&
                    r.informacje.length > 25
                      ? r.informacje.substring(0, 25) + "..."
                      : r.informacje || "-"}
                  </td>
                  <td className="p-2 text-gray-900 text-xs">
                    {r.zalacznik_pdf && (
                      <a
                        href={`https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${r.zalacznik_pdf}`}
                        target="_blank"
                        className="text-blue-500 underline"
                      >
                        PDF
                      </a>
                    )}

                    <div className="flex overflow-x-auto space-x-2 mt-1 max-w-xs">
                      {r.zalacznik_zdjecia?.map((img, index) => (
                        <Image
                          key={index}
                          src={`https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${img}`}
                          alt="Załącznik"
                          width={40} // Szerokość obrazu
                          height={40} // Wysokość obrazu
                          className="h-10 w-10 object-cover rounded cursor-pointer"
                          onClick={() =>
                            handleImageClick(
                              `https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${img}`
                            )
                          }
                          unoptimized
                        />
                      ))}
                    </div>

                    {/* Popup powiększonego zdjęcia */}
                    {zoomedImage && (
                      <div
                        className="fixed inset-0 flex justify-center items-center z-60 popup-image"
                        style={{
                          background: "rgba(0, 0, 0, 0.4) !important",
                        }}
                        onClick={handleClosePopup}
                      >
                        <div className="relative">
                          <Image
                            src={zoomedImage}
                            alt="Powiększone zdjęcie"
                            width={900} // Możesz dostosować szerokość
                            height={900} // Możesz dostosować wysokość
                            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-lg"
                            unoptimized
                          />

                          <button
                            className="absolute top-2 right-2 text-white bg-red-600 px-2 py-1 rounded"
                            onClick={handleClosePopup}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-gray-900">
                    {new Date(r.realizacja_do).toLocaleDateString()}
                  </td>
                  <td className="p-2">
                    <div
                      className={`flex items-center justify-center space-x-1 px-2 py-1 rounded text-white font-bold ${
                        calculateRemainingTime(r.realizacja_do) <= 5
                          ? "bg-red-500"
                          : calculateRemainingTime(r.realizacja_do) <= 10
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                    >
                      {calculateRemainingTime(r.realizacja_do) <= 5 ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : calculateRemainingTime(r.realizacja_do) <= 10 ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      <span>{calculateRemainingTime(r.realizacja_do)} dni</span>
                    </div>
                  </td>
                  <td
                    className="p-2 cursor-pointer"
                    onClick={() =>
                      user?.role === "admin" && handleEditStatus(r)
                    }
                  >
                    <span
                      className={`px-3 py-1 rounded-full text-white text-sm font-semibold ${
                        r.status === "Zgłoszone"
                          ? "bg-yellow-500"
                          : r.status === "Zakończone"
                          ? "bg-green-500"
                          : r.status === "W trakcie realizacji"
                          ? "bg-blue-500"
                          : r.status === "Oczekuje na informacje"
                          ? "bg-red-500"
                          : r.status === "Zaktualizowano"
                          ? "bg-orange-500"
                          : "bg-gray-500"
                      } hover:opacity-80 transition`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-2">
                    <button
                      className="bg-gray-500 text-white px-2 py-1 rounded text-xs"
                      onClick={() => {
                        setSelectedReklamacja(r);
                        setIsPreviewOpen(true);
                      }}
                    >
                      Podgląd
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {isPreviewOpen && selectedReklamacja && (
        <div
          className="fixed inset-0 flex justify-center items-center z-50 modal-preview"
          style={{ background: "rgba(0, 0, 0, 0.4)" }}
        >
          <div className="bg-white rounded-lg shadow-lg p-6 w-2/3 relative">
            <h3 className="text-xl font-semibold mb-4">Podgląd reklamacji</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p>
                  <strong>Nazwa firmy:</strong> {selectedReklamacja.nazwa_firmy}
                </p>
                <p>
                  <strong>Numer faktury:</strong>{" "}
                  {selectedReklamacja.numer_faktury}
                </p>
                <p>
                  <strong>Kod pocztowy:</strong>{" "}
                  {selectedReklamacja.kod_pocztowy}
                </p>
                <p>
                  <strong>Miejscowość:</strong> {selectedReklamacja.miejscowosc}
                </p>
                <p>
                  <strong>Adres:</strong> {selectedReklamacja.adres}
                </p>
                <p className="break-words max-w-[90%] whitespace-pre-wrap">
                  <strong>Opis:</strong> {selectedReklamacja.opis}
                </p>
                <p>
                  <strong>Termin realizacji:</strong>{" "}
                  {new Date(
                    selectedReklamacja.realizacja_do
                  ).toLocaleDateString()}
                </p>
                <p>
                  <strong>Pozostały czas:</strong>{" "}
                  {selectedReklamacja.pozostaly_czas} dni
                </p>
                <p>
                  <strong>Informacje od zgłaszającego:</strong>{" "}
                  {selectedReklamacja.informacje_od_zglaszajacego}
                </p>
                <p className="break-words max-w-[90%] whitespace-pre-wrap">
                  <strong>Informacje od Meblofix:</strong>{" "}
                  {selectedReklamacja.informacje}
                </p>
              </div>
              <div>
                <p>
                  <strong>Załącznik PDF:</strong>
                </p>
                <a
                  href={`https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${selectedReklamacja.zalacznik_pdf}`}
                  target="_blank"
                  className="text-blue-500 underline"
                >
                  Otwórz PDF
                </a>

                <p>
                  <strong>Załączniki zdjęciowe:</strong>
                </p>
                <div className="flex overflow-x-auto space-x-2 mt-1 max-w-full">
                  {selectedReklamacja.zalacznik_zdjecia?.map((img, index) => (
                    <Image
                      key={index}
                      src={`https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${img}`}
                      alt="Załącznik"
                      width={80}
                      height={80}
                      className="h-20 w-20 object-cover rounded cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleImageClick(
                          `https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${img}`
                        );
                      }}
                      unoptimized
                    />
                  ))}
                </div>

                {/* Opis przebiegu reklamacji */}
                {selectedReklamacja.opis_przebiegu && (
                  <>
                    <p className="mt-4">
                      <strong>Opis przebiegu reklamacji:</strong>
                    </p>
                    <p className="break-words max-w-[90%] whitespace-pre-wrap">
                      {selectedReklamacja.opis_przebiegu}
                    </p>
                  </>
                )}

                <p className="mt-4">
                  <strong>Zdjęcia zwrotne:</strong>
                </p>
                <div className="flex overflow-x-auto space-x-2 mt-1 max-w-full">
                  {selectedReklamacja.zalacznik_zakonczenie?.map(
                    (img, index) => (
                      <Image
                        key={index}
                        src={`https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${img}`}
                        alt="Załącznik zakończenia"
                        width={80}
                        height={80}
                        className="h-20 w-20 object-cover rounded cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImageClick(
                            `https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${img}`
                          );
                        }}
                        unoptimized
                      />
                    )
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                className="bg-red-500 text-white px-4 py-2 rounded"
                onClick={() => setIsPreviewOpen(false)}
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
      {isCloseOpen && selectedReklamacja && (
        <div
          className="fixed inset-0 flex justify-center items-center z-50"
          style={{ background: "rgba(0, 0, 0, 0.4)" }}
        >
          <div className="bg-white rounded-lg shadow-lg p-6 w-2/3">
            <h3 className="text-xl font-semibold mb-4">Zakończ reklamację</h3>
            <label className="font-semibold">Opis przebiegu reklamacji</label>
            <textarea
              placeholder="Opis przebiegu reklamacji"
              className="border p-2 w-full h-24 mb-2"
              value={opisPrzebiegu}
              onChange={(e) => setOpisPrzebiegu(e.target.value)}
            />
            <label className="font-semibold">Zdjęcia (maks. 4)</label>
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, index) => (
                <FileUploader
                  key={index}
                  onFileSelect={(file, previewUrl) => {
                    const updatedFiles = [...closeImageFiles];
                    const updatedPreviews = [...closeImagePreviews];
                    updatedFiles[index] = file;
                    updatedPreviews[index] = previewUrl;
                    setCloseImageFiles(updatedFiles);
                    setCloseImagePreviews(updatedPreviews);
                  }}
                  fileType="image/*"
                  label={`Zdjęcie ${index + 1}`}
                  filePreview={closeImagePreviews[index]}
                />
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                className="bg-green-500 text-white px-4 py-2 rounded mr-2"
                onClick={handleFinishReklamacja}
              >
                Zakończ reklamację
              </button>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded"
                onClick={() => setIsCloseOpen(false)}
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

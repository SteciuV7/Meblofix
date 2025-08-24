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
import { geocodeAddress } from "../lib/geocode";

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
  const [potwierdzonoZapoznanie, setPotwierdzonoZapoznanie] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [showMissingDataPopup, setShowMissingDataPopup] = useState(false);
  let reklamacjaData = {};
  if (selectedReklamacja) {
    const { nr_reklamacji, ...restData } = selectedReklamacja;
    reklamacjaData = restData;
  }
  const [closePdfFile, setClosePdfFile] = useState(null);
  const [closePdfPreview, setClosePdfPreview] = useState(null);
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
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusToUpdate, setStatusToUpdate] = useState(null);
  const [reklamacjeZBledem, setReklamacjeZBledem] = useState([]);
  const handleEditStatus = (reklamacja) => {
    setStatusToUpdate(reklamacja);
    setIsStatusModalOpen(true);
  };
  const updateStatus = async (reklamacja) => {
    try {
      const { error } = await supabase
        .from("reklamacje")
        .update({
          status: reklamacja.status,
          nieprzeczytane_dla_uzytkownika: true,
        })
        .eq("id", reklamacja.id);

      if (error) {
        alert(`Błąd aktualizacji statusu: ${error.message}`);
        return;
      }

      alert("✅ Status zaktualizowany!");
      setIsStatusModalOpen(false);
      location.reload();
    } catch (error) {
      alert(`Błąd: ${error.message}`);
    }
  };
  const [selectedReklamacje, setSelectedReklamacje] = useState([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [routeDate, setRouteDate] = useState(new Date());
  const handleSelectReklamacja = (id) => {
    setSelectedReklamacje((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    );
  };
  const assignToRoute = async () => {
    try {
      const { error } = await supabase
        .from("reklamacje")
        .update({ trasa: routeDate.toISOString() })
        .in("id", selectedReklamacje);

      if (error) throw error;

      alert("✅ Reklamacje przypisane do trasy!");
      setIsAssignModalOpen(false);
      setSelectedReklamacje([]);
      fetchReklamacje(); // Odśwież listę
    } catch (error) {
      alert(`Błąd: ${error.message}`);
    }
  };

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
  function calculateRemainingTime(targetDate) {
    const currentDate = new Date();
    const diffTime = new Date(targetDate) - currentDate;
    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return remainingDays > 0 ? remainingDays : 0;
  }

  function hasGeoError(r) {
    return (
      (r.lat == null || r.lon == null) &&
      r.status !== "Zakończone" &&
      r.status !== "Archiwum"
    );
  }

  function handleImageClick(imageUrl) {
    setZoomedImage(imageUrl);
  }

  function handleClosePopup() {
    setZoomedImage(null);
  }

  function FileUploader({
    onFileSelect,
    fileType,
    label,
    filePreview,
    onRemove,
    fileTypeLabel,
  }) {
    const { getRootProps, getInputProps } = useDropzone({
      accept: fileType,
      onDrop: async (acceptedFiles) => {
        let file = acceptedFiles[0];
        if (file && fileType.includes("image")) {
          file = await compressImage(file); // Kompresja tuż po wczytaniu
        }
        const previewUrl = URL.createObjectURL(file);
        onFileSelect(file, previewUrl);
      },
    });

    return (
      <div
        {...getRootProps()}
        className="relative border-dashed border-2 border-gray-300 p-6 text-center cursor-pointer"
      >
        <input {...getInputProps()} />
        {filePreview ? (
          <div className="relative">
            <div className="flex flex-col items-center">
              {fileType.includes("image") ? (
                <Image
                  src={filePreview}
                  alt="Podgląd"
                  width={64}
                  height={64}
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
            {/* Przycisk usuwania */}
            <button
              className="absolute top-0 right-0 bg-red-500 text-white px-2 py-1 rounded"
              onClick={(e) => {
                e.stopPropagation(); // Zapobiega otwieraniu dialogu
                onRemove();
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div>
            <p className="text-blue-500">Wgraj {label} lub przeciągnij tutaj</p>
            <p className="text-gray-500 text-sm">{fileTypeLabel}</p>
          </div>
        )}
      </div>
    );
  }
  async function handleDeleteReklamacja(id) {
    try {
      const { error } = await supabase.from("reklamacje").delete().eq("id", id);

      if (error) {
        alert("Błąd usuwania reklamacji: " + error.message);
        return;
      }

      alert("✅ Reklamacja została usunięta!");
      setIsDeleteModalOpen(false);
      setIsEditOpen(false);
      location.reload();
    } catch (error) {
      alert("Błąd: " + error.message);
    }
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

      let pdfEndPath = null;
      if (closePdfFile) {
        pdfEndPath = await uploadFile(closePdfFile, "pdfs");
      }

      const { error } = await supabase
        .from("reklamacje")
        .update({
          status: "Zakończone",
          opis_przebiegu: opisPrzebiegu,
          zalacznik_zakonczenie: imagePaths,
          zalacznik_pdf_zakonczenie: pdfEndPath, // ✅ zapisz PDF
          nieprzeczytane_dla_uzytkownika: true,
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
        maxSizeMB: 0.5, // Do 500 KB
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      console.log("Rozmiar przed:", file.size / 1024, "KB");
      console.log("Rozmiar po:", compressedFile.size / 1024, "KB");
      return compressedFile;
    } catch (error) {
      console.error("Błąd kompresji:", error);
      return file; // Jak nie wyjdzie, to przekaż oryginał
    }
  }

  function removePolishCharacters(text) {
    const polishMap = {
      ą: "a",
      ć: "c",
      ę: "e",
      ł: "l",
      ń: "n",
      ó: "o",
      ś: "s",
      ż: "z",
      ź: "z",
      Ą: "A",
      Ć: "C",
      Ę: "E",
      Ł: "L",
      Ń: "N",
      Ó: "O",
      Ś: "S",
      Ż: "Z",
      Ź: "Z",
    };
    return text.replace(
      /[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ]/g,
      (char) => polishMap[char] || char
    );
  }

  async function uploadFile(file, folder) {
    try {
      console.log("Rozpoczynanie uploadu pliku:", file.name);

      // Kompresja obrazów
      if (file.type.startsWith("image/")) {
        file = await compressImage(file);
      }

      // Usunięcie polskich znaków z nazwy pliku
      const cleanedFileName = removePolishCharacters(file.name);
      const filePath = `${folder}/${Date.now()}-${cleanedFileName}`;

      const { data, error } = await supabase.storage
        .from("reklamacje")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false, // nie nadpisuje istniejących plików
        });

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
      currentDate.setDate(currentDate.getDate() - 7);
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
        // Jeśli użytkownik jest administratorem, pobieramy wszystkie reklamacje
        ({ data, error } = await supabase
          .from("reklamacje")
          .select("*")
          .order("data_zgloszenia", { ascending: false }));
      } else {
        // Jeśli użytkownik nie jest administratorem, pobieramy reklamacje tylko jego firmy
        ({ data, error } = await supabase
          .from("reklamacje")
          .select("*")
          .eq("firma_id", user?.firma_id) // Filtrujemy po ID firmy
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
              .neq("status", "Archiwum") // Wyklucz archiwum
              .order("data_zgloszenia", { ascending: false }));
          } else if (userData.firma_id) {
            ({ data, reklError } = await supabase
              .from("reklamacje")
              .select("*")
              .eq("firma_id", userData.firma_id)
              .neq("status", "Archiwum") // Wyklucz archiwum
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
          let data;
          let reklError;

          if (userData.rola === "admin") {
            // Administrator widzi wszystkie reklamacje
            ({ data, reklError } = await supabase
              .from("reklamacje")
              .select("*")
              .order("data_zgloszenia", { ascending: false }));
          } else if (userData.firma_id) {
            // Zwykły użytkownik widzi tylko reklamacje swojej firmy
            ({ data, reklError } = await supabase
              .from("reklamacje")
              .select("*")
              .eq("firma_id", userData.firma_id)
              .order("data_zgloszenia", { ascending: false }));
          }

          if (reklError) throw reklError;

          setReklamacje(data || []);
          // Sprawdź, czy użytkownik ma reklamację bez współrzędnych
          if (userData.rola !== "admin") {
            const bledne = data.filter(
              (r) =>
                (r.lat == null || r.lon == null) &&
                r.status !== "Zakończone" &&
                r.status !== "Archiwum"
            );

            if (bledne.length > 0) {
              setReklamacjeZBledem(bledne); // cała reklamacja, nie tylko ID
              setShowMissingDataPopup(true);
            }
          }
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

  // 🔍 Wyszukiwanie i filtrowanie
  useEffect(() => {
    if (!reklamacje || reklamacje.length === 0) return;

    const filtered = reklamacje
      .filter(
        (r) =>
          (r.nazwa_firmy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.numer_faktury?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.miejscowosc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.kod_pocztowy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            new Date(r.data_zgloszenia)
              .toLocaleDateString()
              .includes(searchTerm.toLowerCase()) ||
            r.opis?.toLowerCase().includes(searchTerm.toLowerCase())) &&
          (filterStatus ? r.status === filterStatus : true)
      )
      .sort((a, b) => {
        // 1) Najpierw błędy geokodowania
        const aErr = hasGeoError(a);
        const bErr = hasGeoError(b);
        if (aErr && !bErr) return -1;
        if (!aErr && bErr) return 1;

        // 2) (tylko u zwykłego użytkownika) — najpierw nieprzeczytane
        if (user?.role !== "admin") {
          if (
            a.nieprzeczytane_dla_uzytkownika &&
            !b.nieprzeczytane_dla_uzytkownika
          )
            return -1;
          if (
            !a.nieprzeczytane_dla_uzytkownika &&
            b.nieprzeczytane_dla_uzytkownika
          )
            return 1;
        }

        // 3) Potem data zgłoszenia malejąco
        return new Date(b.data_zgloszenia) - new Date(a.data_zgloszenia);
      });

    setFilteredReklamacje(filtered);
  }, [searchTerm, filterStatus, reklamacje, user]);

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
          className="text-2xl font-bold cursor-pointer hover:text-gray-300 transition flex items-baseline space-x-2"
          onClick={() => router.push("/dashboard")}
        >
          <span>Meblofix Sp. z o.o.</span>
          <span className="text-sm text-gray-400 font-normal">Ver. 8.00</span>
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
          Lista reklamacji
        </h2>

        <div className="flex justify-center mb-4">
          <input
            type="text"
            placeholder="Wyszukaj..."
            className="border p-2 rounded w-1/3 text-gray-900"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="border p-2 rounded text-gray-900"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Wszystkie statusy</option>
            <option value="Zgłoszone">Zgłoszone</option>
            <option value="Zaktualizowano">Zaktualizowano</option>
            <option value="W trakcie realizacji">W trakcie realizacji</option>
            <option value="Oczekuje na informacje">
              Oczekuje na informacje
            </option>
            <option value="Oczekuje na dostawę">Oczekuje na dostawę</option>
            <option value="Zakończone">Zakończone</option>
          </select>
          {/*user?.role === "admin" && (
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
              disabled={selectedReklamacje.length === 0}
              onClick={() => setIsAssignModalOpen(true)}
            >
              Przypisz do trasy
            </button>
          )*/}
          <button
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
            onClick={() => setShowAddModal(true)}
          >
            Dodaj reklamację
          </button>
        </div>
        <div className="overflow-x-auto w-full table-container">
          <table className="table-auto w-full border-separate border-spacing-y-3 table-responsive">
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
                <th className="p-2 text-left">Edycja</th>
              </tr>
            </thead>
            <tbody>
              {(filteredReklamacje || []).map((r) => (
                <tr
                  key={r.id}
                  className={`transition rounded-lg
    ${hasGeoError(r) ? "bg-red-500/80" : ""}
    ${
      user?.role !== "admin" && r.nieprzeczytane_dla_uzytkownika
        ? `${
            r.status === "Zgłoszone"
              ? "bg-yellow-200/80"
              : r.status === "Zakończone"
              ? "bg-green-200/80"
              : r.status === "W trakcie realizacji"
              ? "bg-blue-200/80"
              : r.status === "Oczekuje na informacje"
              ? "bg-red-200/80"
              : r.status === "Oczekuje na dostawę"
              ? "bg-purple-200/80"
              : r.status === "Zaktualizowano"
              ? "bg-orange-200/80"
              : "bg-gray-200/80"
          }`
        : ""
    }`}
                >
                  {/*user?.role === "admin" && (
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedReklamacje.includes(r.id)}
                        onChange={() => handleSelectReklamacja(r.id)}
                      />
                    </td>
                  )*/}
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
                    {r.kod_pocztowy}
                  </td>
                  <td className="p-2 text-gray-900 text-xs">
                    {new Date(r.data_zgloszenia).toLocaleDateString()}
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
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-white text-sm font-semibold ${
                          r.status === "Zgłoszone"
                            ? "bg-yellow-500"
                            : r.status === "Zakończone"
                            ? "bg-green-500"
                            : r.status === "W trakcie realizacji"
                            ? "bg-blue-500"
                            : r.status === "Oczekuje na dostawę"
                            ? "bg-purple-500"
                            : r.status === "Oczekuje na informacje"
                            ? "bg-red-500"
                            : r.status === "Zaktualizowano"
                            ? "bg-orange-500"
                            : "bg-gray-500"
                        }`}
                      >
                        {r.status}
                      </span>

                      {hasGeoError(r) && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700 border border-red-300">
                          Błędny adres
                        </span>
                      )}
                    </div>
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
                  <td className="p-2">
                    {r.status !== "Zakończone" && (
                      <button
                        className="bg-blue-500 text-white px-2 py-1 rounded text-xs"
                        onClick={() => {
                          setSelectedReklamacja(r);
                          setRealizacjaDate(new Date(r.realizacja_do)); // ⬅️ ustawia datę do DatePicker
                          setIsEditOpen(true);
                        }}
                      >
                        Edytuj
                      </button>
                    )}
                  </td>

                  <td className="p-2">
                    {(r.status === "Zgłoszone" ||
                      r.status === "Zaktualizowano") &&
                      user?.role === "admin" && (
                        <div className="flex space-x-2">
                          <button
                            className="bg-green-500 text-white px-2 py-1 rounded text-xs"
                            onClick={async () => {
                              try {
                                const { error } = await supabase
                                  .from("reklamacje")
                                  .update({
                                    status: "W trakcie realizacji",
                                    nieprzeczytane_dla_uzytkownika: true,
                                  })
                                  .eq("id", r.id);

                                if (error) {
                                  alert("Błąd: " + error.message);
                                } else {
                                  alert("✅ Reklamacja została przyjęta!");
                                  location.reload();
                                }
                              } catch (error) {
                                alert("Błąd: " + error.message);
                              }
                            }}
                          >
                            Przyjmij
                          </button>

                          <button
                            className="bg-yellow-500 text-white px-2 py-1 rounded text-xs"
                            onClick={async () => {
                              try {
                                const { error } = await supabase
                                  .from("reklamacje")
                                  .update({
                                    status: "Oczekuje na informacje",
                                    nieprzeczytane_dla_uzytkownika: true,
                                  })
                                  .eq("id", r.id);

                                if (error) {
                                  alert("Błąd: " + error.message);
                                } else {
                                  alert(
                                    "❗ Reklamacja wymaga uzupełnienia informacji!"
                                  );
                                  location.reload();
                                }
                              } catch (error) {
                                alert("Błąd: " + error.message);
                              }
                            }}
                          >
                            Niepełne informacje
                          </button>
                        </div>
                      )}
                  </td>
                  <td className="p-2">
                    {user?.role === "admin" &&
                      (r.status === "W trakcie realizacji" ||
                        r.status === "Oczekuje na dostawę") && (
                        <button
                          className="bg-blue-600 text-white px-2 py-1 rounded text-xs mt-1"
                          onClick={() => {
                            setSelectedReklamacja(r);
                            setIsCloseOpen(true);
                          }}
                        >
                          Oznacz jako zakończone
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showAddModal && (
        <div
          className="fixed inset-0 flex justify-center items-center z-50"
          style={{ background: "rgba(0, 0, 0, 0.4)" }}
        >
          <div className="bg-white rounded-lg shadow-lg p-6 w-2/3">
            <h3 className="text-xl font-semibold mb-4">Dodaj reklamację</h3>

            {/* Podział na 2 kolumny */}
            <div className="grid grid-cols-2 gap-4">
              {/* 🔹 Kolumna 1 (Dane reklamacji) */}
              <div>
                <label className="font-semibold">Nazwa firmy</label>
                <select
                  className="border p-2 w-full mb-2"
                  value={newReklamacja.nazwa_firmy}
                  onChange={(e) =>
                    setNewReklamacja({
                      ...newReklamacja,
                      nazwa_firmy: e.target.value,
                    })
                  }
                >
                  <option value="">Wybierz firmę</option>
                  {firmy
                    .filter(
                      (firma) =>
                        user?.role === "admin" || firma.email === user?.email
                    )
                    .map((firma) => (
                      <option key={firma.firma_id} value={firma.nazwa_firmy}>
                        {firma.nazwa_firmy}
                      </option>
                    ))}
                </select>
                <label className="font-semibold">Numer reklamacji</label>
                <input
                  placeholder="Numer Reklamacji"
                  className="border p-2 w-full mb-2"
                  value={newReklamacja.numer_faktury}
                  onChange={(e) =>
                    setNewReklamacja({
                      ...newReklamacja,
                      numer_faktury: e.target.value,
                    })
                  }
                />
                <label className="font-semibold">Kod pocztowy</label>
                <input
                  placeholder="Kod pocztowy (XX-XXX)"
                  className={`border p-2 w-full mb-2 ${
                    /^\d{2}-\d{3}$/.test(newReklamacja.kod_pocztowy)
                      ? "border-green-500"
                      : "border-red-500"
                  }`}
                  value={newReklamacja.kod_pocztowy}
                  onChange={(e) =>
                    setNewReklamacja({
                      ...newReklamacja,
                      kod_pocztowy: e.target.value,
                    })
                  }
                />
                {!/^\d{2}-\d{3}$/.test(newReklamacja.kod_pocztowy) && (
                  <p className="text-red-500 text-sm">
                    Kod pocztowy powinien mieć format XX-XXX
                  </p>
                )}
                <label className="font-semibold">Miejscowość</label>
                <input
                  placeholder="Miasto"
                  className="border p-2 w-full mb-2"
                  value={newReklamacja.miejscowosc}
                  onChange={(e) =>
                    setNewReklamacja({
                      ...newReklamacja,
                      miejscowosc: e.target.value,
                    })
                  }
                />
                <label className="font-semibold">Adres</label>
                <input
                  placeholder="Adres"
                  className="border p-2 w-full mb-2"
                  value={newReklamacja.adres}
                  onChange={(e) =>
                    setNewReklamacja({
                      ...newReklamacja,
                      adres: e.target.value,
                    })
                  }
                />
                {/* 🔹 Informacje od zgłaszającego */}
                <label className="font-semibold">
                  Informacje od zgłaszającego
                </label>
                <textarea
                  placeholder="Informacje od zgłaszającego"
                  className="border p-2 w-full mt-4 mb-2"
                  value={newReklamacja.informacje_od_zglaszajacego}
                  onChange={(e) =>
                    setNewReklamacja({
                      ...newReklamacja,
                      informacje_od_zglaszajacego: e.target.value,
                    })
                  }
                />
                <label className="font-semibold">Termin realizacji</label>
                <p></p>
                <DatePicker
                  selected={realizacjaDate}
                  onChange={(date) => {
                    setRealizacjaDate(date);
                    setNewReklamacja({
                      ...newReklamacja,
                      realizacja_do: date.toISOString(),
                    });
                  }}
                  dateFormat="yyyy-MM-dd"
                  className="border p-2 w-full mb-2 rounded"
                />
              </div>

              {/* 🔹 Kolumna 2 (Opis + Załączniki) */}
              <div>
                <label className="font-semibold">Opis</label>
                <textarea
                  placeholder="Opis"
                  className="border p-2 w-full h-24 mb-2"
                  value={newReklamacja.opis}
                  onChange={(e) =>
                    setNewReklamacja({ ...newReklamacja, opis: e.target.value })
                  }
                />

                {/* Załącznik PDF */}
                <label className="font-semibold text-gray-700">
                  Załącznik PDF (wymagany)
                </label>
                <FileUploader
                  onFileSelect={(file) => {
                    setPdfFile(file);
                    setPdfPreview(URL.createObjectURL(file));
                  }}
                  fileType="application/pdf"
                  fileTypeLabel="PDF"
                  label="PDF"
                  filePreview={pdfPreview}
                  onRemove={() => {
                    setPdfFile(null);
                    setPdfPreview(null);
                  }}
                />
                {!pdfFile && (
                  <p className="text-red-500 text-sm">
                    Załącznik PDF jest wymagany
                  </p>
                )}

                {/* Załączniki zdjęciowe */}
                <label className="font-semibold text-gray-700 mt-4">
                  Załączniki zdjęciowe (opcjonalne)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(4)].map((_, index) => (
                    <FileUploader
                      key={index}
                      onFileSelect={(file) => {
                        const updatedFiles = [...imageFiles];
                        const updatedPreviews = [...imagePreviews];

                        updatedFiles[index] = file;
                        updatedPreviews[index] = URL.createObjectURL(file);

                        setImageFiles(updatedFiles);
                        setImagePreviews(updatedPreviews);
                      }}
                      fileType="image/*"
                      fileTypeLabel="PNG, JPG, GIF, SVG"
                      label={`Zdjęcie ${index + 1}`}
                      filePreview={imagePreviews[index]}
                      onRemove={() => {
                        const updatedFiles = [...imageFiles];
                        const updatedPreviews = [...imagePreviews];

                        updatedFiles[index] = null;
                        updatedPreviews[index] = null;

                        setImageFiles(updatedFiles);
                        setImagePreviews(updatedPreviews);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 🔹 Przycisk zapisu i anulowania */}
            <div className="flex justify-end">
              <button
                className="bg-green-500 text-white px-4 py-2 rounded mr-2"
                disabled={
                  !/^\d{2}-\d{3}$/.test(newReklamacja.kod_pocztowy) ||
                  newReklamacja.nazwa_firmy === ""
                }
                onClick={async () => {
                  try {
                    if (!pdfFile) {
                      alert("PDF jest wymagany!");
                      return;
                    }

                    const pdfPath = await uploadFile(pdfFile, "pdfs");
                    if (!pdfPath) {
                      alert("Błąd podczas przesyłania PDF.");
                      return;
                    }

                    const imagePaths = [];
                    for (let i = 0; i < imageFiles.length; i++) {
                      if (imageFiles[i]) {
                        const imagePath = await uploadFile(
                          imageFiles[i],
                          "images"
                        );
                        if (imagePath) imagePaths.push(imagePath);
                      }
                    }

                    const remainingTime =
                      calculateRemainingTime(realizacjaDate);

                    const { data: inserted, error } = await supabase
                      .from("reklamacje")
                      .insert([
                        {
                          ...newReklamacja,
                          firma_id: user.firma_id, // Przypisujemy firmę
                          zalacznik_pdf: pdfPath,
                          zalacznik_zdjecia: imagePaths,
                          data_zakonczenia: realizacjaDate.toISOString(),
                          realizacja_do: realizacjaDate.toISOString(),
                          pozostaly_czas: remainingTime,
                          nieprzeczytane_dla_uzytkownika: true,
                        },
                      ])
                      .select(); // potrzebne żeby dostać ID

                    if (error) {
                      alert(error.message);
                    } else {
                      // 🔍 pełny adres z pól
                      const fullAddress = `${newReklamacja.miejscowosc}, ${newReklamacja.kod_pocztowy} ${newReklamacja.adres}`;
                      const coords = await geocodeAddress(fullAddress);

                      // 🧭 jeśli znaleziono współrzędne – zapisujemy je do tej nowo dodanej reklamacji
                      if (coords && inserted && inserted.length > 0) {
                        await supabase
                          .from("reklamacje")
                          .update({ lat: coords.lat, lon: coords.lon })
                          .eq("id", inserted[0].id);
                      }

                      alert("✅ Dodano reklamację!");
                      setShowAddModal(false);
                      location.reload();
                    }
                  } catch (error) {
                    alert(`Błąd: ${error.message}`);
                  }
                }}
              >
                Zapisz
              </button>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded"
                onClick={() => setShowAddModal(false)}
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
      {isPreviewOpen && selectedReklamacja && (
        <div
          className="fixed inset-0 flex justify-center items-center z-50 modal-preview overflow-y-auto"
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
                  <strong>Numer reklamacji:</strong>{" "}
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

                {/* PDF po zakończeniu */}
                {selectedReklamacja.zalacznik_pdf_zakonczenie && (
                  <>
                    <p className="mt-4">
                      <strong>PDF po zakończeniu:</strong>
                    </p>
                    <a
                      href={`https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${selectedReklamacja.zalacznik_pdf_zakonczenie}`}
                      target="_blank"
                      className="text-blue-500 underline"
                    >
                      Otwórz PDF
                    </a>
                  </>
                )}

                {/* Zdjęcia zwrotne */}
                {selectedReklamacja.zalacznik_zakonczenie?.length > 0 && (
                  <>
                    <p className="mt-4">
                      <strong>Zdjęcia zwrotne:</strong>
                    </p>
                    <div className="flex overflow-x-auto space-x-2 mt-1 max-w-full">
                      {selectedReklamacja.zalacznik_zakonczenie.map(
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
                  </>
                )}
              </div>
            </div>
            {user?.role !== "admin" &&
              selectedReklamacja.nieprzeczytane_dla_uzytkownika && (
                <div className="mt-6 p-4 border border-yellow-400 rounded bg-yellow-100 text-gray-900">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      className="form-checkbox h-5 w-5 text-yellow-600"
                      checked={potwierdzonoZapoznanie}
                      onChange={(e) =>
                        setPotwierdzonoZapoznanie(e.target.checked)
                      }
                    />
                    <span className="font-medium">
                      Potwierdzam zapoznanie się z reklamacją
                    </span>
                  </label>
                </div>
              )}

            <div className="flex justify-end mt-4">
              <button
                className="bg-red-500 text-white px-4 py-2 rounded"
                onClick={async () => {
                  // Jeśli użytkownik i reklamacja nieprzeczytana — musi zaznaczyć checkbox
                  if (
                    user?.role !== "admin" &&
                    selectedReklamacja.nieprzeczytane_dla_uzytkownika &&
                    !potwierdzonoZapoznanie
                  ) {
                    alert("Aby zamknąć, musisz zaznaczyć potwierdzenie.");
                    return;
                  }

                  try {
                    // Jeśli checkbox zaznaczony i reklamacja nieprzeczytana — aktualizuj
                    if (
                      user?.role !== "admin" &&
                      selectedReklamacja.nieprzeczytane_dla_uzytkownika &&
                      potwierdzonoZapoznanie
                    ) {
                      const { error } = await supabase
                        .from("reklamacje")
                        .update({ nieprzeczytane_dla_uzytkownika: false })
                        .eq("id", selectedReklamacja.id);

                      if (error) throw error;
                    }

                    setIsPreviewOpen(false); // Zamknij modal
                    setSelectedReklamacja(null); // Wyczyść zaznaczenie
                    fetchReklamacje(); // Odśwież dane
                  } catch (error) {
                    alert("Błąd podczas zamykania: " + error.message);
                  }
                }}
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditOpen && selectedReklamacja && (
        <div
          className="fixed inset-0 flex justify-center items-center z-50"
          style={{ background: "rgba(0, 0, 0, 0.4)" }}
        >
          <div className="bg-white rounded-lg shadow-lg p-6 w-2/3 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Edytuj reklamację</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold">Nazwa firmy</label>
                <input
                  type="text"
                  className="border p-2 w-full mb-2"
                  value={selectedReklamacja.nazwa_firmy}
                  onChange={(e) =>
                    setSelectedReklamacja({
                      ...selectedReklamacja,
                      nazwa_firmy: e.target.value,
                    })
                  }
                />

                <label className="font-semibold">Numer Reklamacji</label>
                <input
                  type="text"
                  className="border p-2 w-full mb-2"
                  value={selectedReklamacja.numer_faktury}
                  onChange={(e) =>
                    setSelectedReklamacja({
                      ...selectedReklamacja,
                      numer_faktury: e.target.value,
                    })
                  }
                />

                <label className="font-semibold">Kod pocztowy</label>
                <input
                  type="text"
                  className="border p-2 w-full mb-2"
                  value={selectedReklamacja.kod_pocztowy}
                  onChange={(e) =>
                    setSelectedReklamacja({
                      ...selectedReklamacja,
                      kod_pocztowy: e.target.value,
                    })
                  }
                />

                <label className="font-semibold">Miejscowość</label>
                <input
                  type="text"
                  className="border p-2 w-full mb-2"
                  value={selectedReklamacja.miejscowosc}
                  onChange={(e) =>
                    setSelectedReklamacja({
                      ...selectedReklamacja,
                      miejscowosc: e.target.value,
                    })
                  }
                />

                <label className="font-semibold">Adres</label>
                <input
                  type="text"
                  className="border p-2 w-full mb-2"
                  value={selectedReklamacja.adres}
                  onChange={(e) =>
                    setSelectedReklamacja({
                      ...selectedReklamacja,
                      adres: e.target.value,
                    })
                  }
                />
                <label className="font-semibold">Termin realizacji</label>
                <p></p>
                <DatePicker
                  selected={realizacjaDate}
                  onChange={(date) => {
                    setRealizacjaDate(date);
                    setSelectedReklamacja({
                      ...selectedReklamacja,
                      realizacja_do: date.toISOString(),
                    });
                  }}
                  dateFormat="yyyy-MM-dd"
                  className="border p-2 w-full mb-2 rounded"
                />
                <p></p>
                {user?.role === "admin" && (
                  <label className="font-semibold">
                    Informacje od Meblofix
                    <p></p>
                  </label>
                )}
                {user?.role === "admin" && (
                  <textarea
                    className="border p-2 w-full mb-2"
                    value={selectedReklamacja.informacje}
                    onChange={(e) =>
                      setSelectedReklamacja({
                        ...selectedReklamacja,
                        informacje: e.target.value,
                      })
                    }
                  />
                )}
              </div>

              <div>
                <label className="font-semibold">Opis</label>
                <textarea
                  className="border p-2 w-full mb-2"
                  value={selectedReklamacja.opis}
                  onChange={(e) =>
                    setSelectedReklamacja({
                      ...selectedReklamacja,
                      opis: e.target.value,
                    })
                  }
                />

                {/* Załącznik PDF */}
                <label className="font-semibold text-gray-700">
                  Załącznik PDF (wymagany)
                </label>
                <FileUploader
                  onFileSelect={(file) => {
                    setPdfFile(file);
                    setPdfPreview(previewUrl);
                  }}
                  fileType="application/pdf"
                  fileTypeLabel="PDF"
                  label="PDF"
                  filePreview={pdfPreview}
                  onRemove={() => {
                    setPdfFile(null);
                    setPdfPreview(null);
                  }}
                />

                {/* Załączniki zdjęciowe */}
                <label className="font-semibold text-gray-700 mt-4">
                  Załączniki zdjęciowe (opcjonalne)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(4)].map((_, index) => (
                    <FileUploader
                      key={index}
                      onFileSelect={(file, previewUrl) => {
                        const updatedFiles = [...imageFiles];
                        const updatedPreviews = [...imagePreviews];

                        updatedFiles[index] = file;
                        updatedPreviews[index] = previewUrl;

                        setImageFiles(updatedFiles);
                        setImagePreviews(updatedPreviews);
                      }}
                      fileType="image/*"
                      fileTypeLabel="PNG, JPG, GIF, SVG"
                      label={`Zdjęcie ${index + 1}`}
                      filePreview={imagePreviews[index]}
                      onRemove={() => {
                        const updatedFiles = [...imageFiles];
                        const updatedPreviews = [...imagePreviews];

                        updatedFiles[index] = null;
                        updatedPreviews[index] = null;

                        setImageFiles(updatedFiles);
                        setImagePreviews(updatedPreviews);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {user?.role === "admin" && (
              <div className="mt-6 border-t pt-4">
                <h4 className="text-lg font-semibold mb-2">
                  Dane zakończenia reklamacji (admin)
                </h4>

                <label className="font-semibold">
                  Opis przebiegu reklamacji
                </label>
                <textarea
                  className="border p-2 w-full mb-4"
                  value={selectedReklamacja.opis_przebiegu || ""}
                  onChange={(e) =>
                    setSelectedReklamacja({
                      ...selectedReklamacja,
                      opis_przebiegu: e.target.value,
                    })
                  }
                />

                <label className="font-semibold">
                  PDF zakończenia (opcjonalny)
                </label>
                <FileUploader
                  onFileSelect={(file) => {
                    setClosePdfFile(file);
                    setClosePdfPreview(URL.createObjectURL(file));
                  }}
                  fileType="application/pdf"
                  fileTypeLabel="PDF"
                  label="PDF zakończenia"
                  filePreview={closePdfPreview}
                  onRemove={() => {
                    setClosePdfFile(null);
                    setClosePdfPreview(null);
                  }}
                />
                {selectedReklamacja.zalacznik_pdf_zakonczenie && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-700">Aktualny PDF:</p>
                    <a
                      href={`https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${selectedReklamacja.zalacznik_pdf_zakonczenie}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Zobacz aktualny PDF
                    </a>
                  </div>
                )}
                <label className="font-semibold mt-4 block">
                  Zdjęcia zakończeniowe (maks. 4)
                </label>
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
                      fileTypeLabel="PNG, JPG, GIF"
                      label={`Zdjęcie ${index + 1}`}
                      filePreview={closeImagePreviews[index]}
                      onRemove={() => {
                        const updatedFiles = [...closeImageFiles];
                        const updatedPreviews = [...closeImagePreviews];

                        updatedFiles[index] = null;
                        updatedPreviews[index] = null;

                        setCloseImageFiles(updatedFiles);
                        setCloseImagePreviews(updatedPreviews);
                      }}
                    />
                  ))}
                  {selectedReklamacja.zalacznik_zakonczenie?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-700 mb-1">
                        Aktualne zdjęcia:
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {selectedReklamacja.zalacznik_zakonczenie.map(
                          (img, index) => (
                            <Image
                              key={index}
                              src={`https://dpqfpqxgzpkhpulbiype.supabase.co/storage/v1/object/public/reklamacje/${img}`}
                              alt={`Zakończenie ${index + 1}`}
                              width={80}
                              height={80}
                              className="rounded object-cover h-20 w-20"
                              unoptimized
                            />
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-4">
              {user?.role === "admin" && (
                <button
                  className="bg-red-600 text-white px-4 py-2 rounded mr-2"
                  onClick={() => setIsDeleteModalOpen(true)}
                >
                  Usuń reklamację
                </button>
              )}
              <button
                className="bg-green-500 text-white px-4 py-2 rounded mr-2"
                onClick={async () => {
                  try {
                    let pdfPath = selectedReklamacja?.zalacznik_pdf;
                    if (pdfFile) {
                      pdfPath = await uploadFile(pdfFile, "pdfs");
                    }

                    const imagePaths = selectedReklamacja.zalacznik_zdjecia
                      ? [...selectedReklamacja.zalacznik_zdjecia]
                      : [];
                    for (let i = 0; i < imageFiles.length; i++) {
                      if (imageFiles[i]) {
                        const imagePath = await uploadFile(
                          imageFiles[i],
                          "images"
                        );
                        imagePaths[i] = imagePath;
                      }
                    }

                    // ➕ Nowość: upload danych zakończeniowych (dla admina)
                    let pdfZakonczeniePath =
                      selectedReklamacja?.zalacznik_pdf_zakonczenie || null;
                    if (user?.role === "admin" && closePdfFile) {
                      pdfZakonczeniePath = await uploadFile(
                        closePdfFile,
                        "pdfs"
                      );
                    }

                    let zalacznikZakonczenie =
                      selectedReklamacja.zalacznik_zakonczenie
                        ? [...selectedReklamacja.zalacznik_zakonczenie]
                        : [];

                    if (user?.role === "admin") {
                      for (let i = 0; i < closeImageFiles.length; i++) {
                        if (closeImageFiles[i]) {
                          const imagePath = await uploadFile(
                            closeImageFiles[i],
                            "images"
                          );
                          zalacznikZakonczenie[i] = imagePath;
                        }
                      }
                    }

                    const remainingTime =
                      calculateRemainingTime(realizacjaDate);

                    const { nr_reklamacji, ...reklamacjaData } =
                      selectedReklamacja;

                    const aktualizowaneDane = {
                      ...reklamacjaData,
                      zalacznik_pdf: pdfPath,
                      zalacznik_zdjecia: imagePaths,
                      realizacja_do: realizacjaDate.toISOString(),
                      pozostaly_czas: remainingTime,
                      status: "Zaktualizowano",
                      ...(user?.role === "admin" && {
                        nieprzeczytane_dla_uzytkownika: true,
                      }),
                    };

                    // 🧠 Sprawdź, czy zmienił się adres → jeśli tak, wyzeruj współrzędne
                    const { data: staraReklamacja, error: fetchError } =
                      await supabase
                        .from("reklamacje")
                        .select("adres, miejscowosc, kod_pocztowy")
                        .eq("id", selectedReklamacja.id)
                        .single();

                    if (fetchError) {
                      alert("❌ Błąd pobierania danych z bazy");
                      return;
                    }

                    const adresZmieniony =
                      staraReklamacja.adres !== selectedReklamacja.adres ||
                      staraReklamacja.miejscowosc !==
                        selectedReklamacja.miejscowosc ||
                      staraReklamacja.kod_pocztowy !==
                        selectedReklamacja.kod_pocztowy;

                    if (adresZmieniony) {
                      aktualizowaneDane.lat = null;
                      aktualizowaneDane.lon = null;
                    }

                    // ➕ tylko jeśli admin, dodaj dane z zakończenia
                    if (user?.role === "admin") {
                      aktualizowaneDane.opis_przebiegu =
                        selectedReklamacja.opis_przebiegu || "";
                      aktualizowaneDane.zalacznik_pdf_zakonczenie =
                        pdfZakonczeniePath;
                      aktualizowaneDane.zalacznik_zakonczenie =
                        zalacznikZakonczenie;
                      aktualizowaneDane.nieprzeczytane_dla_uzytkownika = true;
                    }

                    const { error } = await supabase
                      .from("reklamacje")
                      .update(aktualizowaneDane)
                      .eq("id", selectedReklamacja.id);

                    if (error) {
                      alert(error.message);
                    } else {
                      if (!aktualizowaneDane.lat && !aktualizowaneDane.lon) {
                        const fullAddress = `${selectedReklamacja.miejscowosc}, ${selectedReklamacja.kod_pocztowy} ${selectedReklamacja.adres}`;
                        const coords = await geocodeAddress(fullAddress);

                        if (coords) {
                          await supabase
                            .from("reklamacje")
                            .update({ lat: coords.lat, lon: coords.lon })
                            .eq("id", selectedReklamacja.id);
                        }
                      }
                      alert("✅ Zaktualizowano reklamację!");
                      setIsEditOpen(false);
                      location.reload();
                    }
                  } catch (error) {
                    alert(`Błąd: ${error.message}`);
                  }
                }}
              >
                Zapisz
              </button>

              <button
                className="bg-red-500 text-white px-4 py-2 rounded"
                onClick={() => setIsEditOpen(false)}
              >
                Anuluj
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
            <label className="font-semibold mt-4">
              Załącznik PDF (opcjonalny)
            </label>
            <FileUploader
              onFileSelect={(file) => {
                setClosePdfFile(file);
                setClosePdfPreview(URL.createObjectURL(file));
              }}
              fileType="application/pdf"
              fileTypeLabel="PDF do 2MB"
              label="PDF zakończenia"
              filePreview={closePdfPreview}
              onRemove={() => {
                setClosePdfFile(null);
                setClosePdfPreview(null);
              }}
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
                  fileTypeLabel="PNG, JPG, GIF, SVG"
                  label={`Zdjęcie ${index + 1}`}
                  filePreview={closeImagePreviews[index]}
                  onRemove={() => {
                    const updatedFiles = [...closeImageFiles];
                    const updatedPreviews = [...closeImagePreviews];

                    updatedFiles[index] = null;
                    updatedPreviews[index] = null;

                    setCloseImageFiles(updatedFiles);
                    setCloseImagePreviews(updatedPreviews);
                  }}
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
      {isStatusModalOpen && (
        <div
          className="fixed inset-0 flex justify-center items-center z-50"
          style={{ background: "rgba(0, 0, 0, 0.4)" }}
        >
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">
              Zmień status reklamacji
            </h3>
            <select
              className="border p-2 rounded w-full"
              value={statusToUpdate?.status}
              onChange={(e) =>
                setStatusToUpdate({ ...statusToUpdate, status: e.target.value })
              }
            >
              <option value="Zgłoszone">Zgłoszone</option>
              <option value="W trakcie realizacji">W trakcie realizacji</option>
              <option value="Oczekuje na informacje">
                Oczekuje na informacje
              </option>
              <option value="Oczekuje na dostawę">Oczekuje na dostawę</option>
              <option value="Zakończone">Zakończone</option>
              <option value="Zaktualizowano">Zaktualizowano</option>
            </select>
            <div className="flex justify-end mt-4">
              <button
                className="bg-green-500 text-white px-4 py-2 rounded mr-2"
                onClick={() => updateStatus(statusToUpdate)}
              >
                Zapisz
              </button>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded"
                onClick={() => setIsStatusModalOpen(false)}
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
      {isAssignModalOpen && (
        <div
          className="fixed inset-0 flex justify-center items-center z-50"
          style={{ background: "rgba(0, 0, 0, 0.4)" }}
        >
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Przypisz do trasy</h3>
            <label className="font-semibold">Wybierz datę trasy:</label>
            <DatePicker
              selected={routeDate}
              onChange={(date) => setRouteDate(date)}
              dateFormat="yyyy-MM-dd"
              className="border p-2 w-full mb-4 rounded"
            />
            <div className="flex justify-end">
              <button
                className="bg-green-500 text-white px-4 py-2 rounded mr-2"
                onClick={assignToRoute}
              >
                Zapisz
              </button>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded"
                onClick={() => setIsAssignModalOpen(false)}
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 flex justify-center items-center z-50"
          style={{ background: "rgba(0, 0, 0, 0.4)" }}
        >
          <div className="bg-white rounded-lg shadow-lg p-6 w-1/3">
            <h3 className="text-xl font-semibold mb-4">
              Potwierdzenie usunięcia
            </h3>
            <p>
              Czy na pewno chcesz usunąć tę reklamację? Tej operacji nie można
              cofnąć.
            </p>
            <div className="flex justify-end mt-4">
              <button
                className="bg-red-600 text-white px-4 py-2 rounded mr-2"
                onClick={() => handleDeleteReklamacja(selectedReklamacja.id)}
              >
                Usuń
              </button>
              <button
                className="bg-gray-500 text-white px-4 py-2 rounded"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
      {showMissingDataPopup && (
        <div
          className="fixed inset-0 flex justify-center items-center z-50"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
        >
          <div className="bg-white rounded-lg shadow-lg p-6 w-1/2 text-center">
            <h2 className="text-xl font-bold mb-4 text-red-600">Uwaga!</h2>
            <p className="text-gray-800 mb-4">
              W jednej lub więcej Twoich reklamacji zostały wpisane błędne dane
              adresowe. Prosimy o ich uzupełnienie, aby możliwe było poprawne
              wyświetlenie na mapie.{" "}
              <b>Polecamy przepisanie adresu z map Google.</b>
            </p>

            <p className="text-gray-800 mb-2 font-semibold">
              Najczęstsze błędy w adresach:
            </p>
            <ul className="list-disc list-inside text-gray-800 mb-4 text-sm">
              <li>
                <span className="font-medium">m36 / lok 36</span> zamiast{" "}
                <span className="font-medium">/36</span> (np.{" "}
                <i>Obrońców m36</i> → <b>Obrońców 6/36</b>)
              </li>
              <li>
                <span className="font-medium">
                  Brak numeru budynku lub mieszkania
                </span>{" "}
                (np. <i>Polna</i> → <b>Polna 6A</b>)
              </li>
              <li>
                <span className="font-medium">Użycie skrótu „ul.”</span> (np.{" "}
                <i>ul. Nowa 18</i> → <b>Nowa 18</b>)
              </li>
              <li>
                <span className="font-medium">Skrócone nazwy ulic</span> (np.{" "}
                <i>gen. Andersa</i> → <b>Generała Andersa</b>)
              </li>
              <li>
                <span className="font-medium">
                  Użycie dużych liter w całym adresie
                </span>{" "}
                (np. <i>DULCZA WIELKA, UL.NOWA 18</i> →{" "}
                <b>Dulcza Wielka, Nowa 18</b>)
              </li>
            </ul>

            {reklamacjeZBledem.length > 0 && (
              <div className="mb-4 text-left text-sm">
                <p className="font-semibold mb-2">Reklamacje do poprawy:</p>
                <ul className="list-disc list-inside text-red-600">
                  {reklamacjeZBledem.map((rek) => (
                    <li key={rek.id}>Numer: {rek.numer_faktury}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              className="bg-red-600 text-white px-6 py-2 rounded"
              onClick={() => setShowMissingDataPopup(false)}
            >
              Zamknij
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

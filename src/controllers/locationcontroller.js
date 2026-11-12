const fetch = require("node-fetch");

const getAddressFromCoOrdintes = async (req, res) => {
  const lat = req.query.lat;
  const long = req.query.long;

  try {
    if (lat && long) {
      console.log(lat, long);
      const requestOptions = {
        method: "GET",
        headers: {
          "User-Agent": "HireInSecond-API/1.0 (contact@hireinsecond.com)",
          Accept: "application/json",
        },
      };

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${long}&format=json`,
        requestOptions
      );

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const data = await response.json();
      console.log(data);

      const responseData = {
        success: true,
        message: "Location fetched successfully",
        data: data,
      };

      res.status(200).json(responseData);
    } else {
      res.status(400).json({
        success: false,
        message: "Bad request",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
let apiToken = async () => {
  const requestOptions = {
    method: "GET",
    headers: {
      Accept: "application/json",
      "api-token":
        "Einq8KZaJLfI1NeOpLIoMJ1-EOW56DzelUxTFDoQ_QhKOdiaOfpiQncAgM9BJ98bClQ",
      "user-email": "rahuljha3246@gmail.com",
    },
  };

  const response = await fetch(
    `https://www.universal-tutorial.com/api/getaccesstoken`,
    requestOptions
  );

  if (!response.ok) {
    return false;
  } else {
    const data = await response.json();
    return `Bearer ${data?.auth_token}`;
  }
};

const getCountries = async (req, res) => {
  const token = await apiToken();
  console.log(token);
  try {
    if (token) {
      const requestOptions = {
        method: "GET",
        headers: {
          Authorization: token,
          Accept: "application/json",
        },
      };

      const response = await fetch(
        `https://www.universal-tutorial.com/api/countries/`,
        requestOptions
      );

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const data = await response.json();

      const responseData = {
        success: true,
        message: "Countries fetched successfully",
        data: data,
      };

      res.status(200).json(responseData);
    } else {
      res.status(400).json({
        success: false,
        message: "Bad request",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getStates = async (req, res) => {
  const token = await apiToken();
  const country = req.query.country;
  try {
    if (country && country !== "") {
      if (token) {
        const requestOptions = {
          method: "GET",
          headers: {
            Authorization: token,
            Accept: "application/json",
          },
        };

        const response = await fetch(
          `https://www.universal-tutorial.com/api/states/${country}`,
          requestOptions
        );

        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }

        const data = await response.json();

        const responseData = {
          success: true,
          message: `${country} States fetched successfully`,
          data: data,
        };

        res.status(200).json(responseData);
      } else {
        res.status(400).json({
          success: false,
          message: "Bad request",
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: "Bad request",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
const CURATED_LOCALITIES = {
  Delhi: [
    "Connaught Place", "Janakpuri", "Rohini", "Dwarka", "Saket", "Hauz Khas",
    "Lajpat Nagar", "Karol Bagh", "Pitampura", "Vasant Kunj", "Nehru Place",
    "Mayur Vihar", "South Extension", "Okhla", "Chanakyapuri", "Rajouri Garden"
  ],
  Bengaluru: [
    "Koramangala", "HSR Layout", "Indiranagar", "Whitefield", "Electronic City",
    "Jayanagar", "Marathahalli", "Bellandur", "BTM Layout", "Hebbal", "JP Nagar",
    "MG Road", "Banashankari", "Yelahanka", "Rajajinagar", "Malleshwaram"
  ],
  Bangalore: [
    "Koramangala", "HSR Layout", "Indiranagar", "Whitefield", "Electronic City",
    "Jayanagar", "Marathahalli", "Bellandur", "BTM Layout", "Hebbal", "JP Nagar",
    "MG Road", "Banashankari", "Yelahanka", "Rajajinagar", "Malleshwaram"
  ],
  Mumbai: [
    "Andheri East", "Andheri West", "Bandra West", "Bandra Kurla Complex (BKC)",
    "Powai", "Lower Parel", "Goregaon", "Malad", "Borivali", "Worli", "Dadar",
    "Colaba", "Juhu", "Kandivali", "Chembur", "Navi Mumbai", "Thane"
  ],
  Hyderabad: [
    "Hitec City", "Gachibowli", "Madhapur", "Kondapur", "Jubilee Hills",
    "Banjara Hills", "Kukatpally", "Begumpet", "Ameerpet", "Secunderabad",
    "Manikonda", "Financial District", "Uppal", "Miyapur"
  ],
  Pune: [
    "Hinjewadi", "Kharadi", "Viman Nagar", "Kothrud", "Aundh", "Baner",
    "Wakad", "Magarpatta City", "Hadapsar", "Kalyani Nagar", "Shivajinagar",
    "Pimple Saudagar", "Bavdhan"
  ],
  Chennai: [
    "OMR", "Guindy", "T. Nagar", "Velachery", "Adyar", "Anna Nagar",
    "Thoraipakkam", "Sholinganallur", "Perungudi", "Porur", "Nungambakkam"
  ],
  Noida: [
    "Sector 62", "Sector 18", "Sector 63", "Sector 15", "Sector 16",
    "Sector 128", "Sector 135", "Sector 142", "Sector 50", "Greater Noida West"
  ],
  Gurgaon: [
    "Cyber City", "Golf Course Road", "Sector 29", "Sohna Road", "Udyog Vihar",
    "DLF Phase 1-5", "Sector 48", "Sector 56", "MG Road", "Manesar"
  ],
  Gurugram: [
    "Cyber City", "Golf Course Road", "Sector 29", "Sohna Road", "Udyog Vihar",
    "DLF Phase 1-5", "Sector 48", "Sector 56", "MG Road", "Manesar"
  ],
  Kolkata: [
    "Salt Lake Sector V", "New Town", "Park Street", "Rajarhat", "Ballygunge",
    "Howrah", "Dum Dum", "Behala", "Garia", "Alipore"
  ],
  Ahmedabad: [
    "SG Highway", "Prahlad Nagar", "Bodakdev", "Satellite", "Navrangpura",
    "Vastrapur", "Maninagar", "Gota", "Thaltej", "Bopal"
  ],
  Jaipur: [
    "Malviya Nagar", "Vaishali Nagar", "C-Scheme", "Mansarovar", "Tonk Road",
    "Raja Park", "Jagatpura", "Sitapura", "Ajmer Road"
  ],
  Chandigarh: [
    "Sector 17", "Sector 35", "Sector 22", "Sector 43", "IT Park",
    "Mohali Phase 7", "Mohali Phase 8", "Panchkula Sector 5"
  ]
};

const getLocalities = async (req, res) => {
  const city = (req.query.city || "").trim();
  const input = (req.query.input || "").trim();

  if (!city) {
    return res.status(400).json({
      success: false,
      message: "city query parameter is required",
    });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (apiKey) {
    try {
      if (input) {
        // Places Autocomplete (New)
        const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
          },
          body: JSON.stringify({
            input: `${input}, ${city}`,
            includedPrimaryTypes: [
              "locality",
              "sublocality",
              "neighborhood",
              "sublocality_level_1",
              "sublocality_level_2",
            ],
            includedRegionCodes: ["in"],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.suggestions && data.suggestions.length > 0) {
            const localities = data.suggestions
              .map((s) => {
                const text =
                  s.placePrediction?.structuredFormat?.mainText?.text ||
                  s.placePrediction?.text?.text ||
                  "";
                return { locality: text, city };
              })
              .filter((x) => x.locality);

            if (localities.length > 0) {
              return res.status(200).json({ success: true, data: localities });
            }
          }
        }
      } else {
        // Places Text Search (New)
        const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress",
          },
          body: JSON.stringify({
            textQuery: `localities in ${city}`,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.places && data.places.length > 0) {
            const localities = data.places
              .map((p) => {
                const text = p.displayName?.text || "";
                return { locality: text, city };
              })
              .filter((x) => x.locality);

            if (localities.length > 0) {
              return res.status(200).json({ success: true, data: localities });
            }
          }
        }
      }
    } catch (err) {
      console.warn("Google Places API error, using fallback:", err.message);
    }
  }

  // Fallback: curated list + Nominatim
  const matchedKey = Object.keys(CURATED_LOCALITIES).find(
    (k) => k.toLowerCase() === city.toLowerCase()
  );
  let curated = matchedKey ? CURATED_LOCALITIES[matchedKey] : [];

  if (input) {
    const lowerInput = input.toLowerCase();
    const filteredCurated = curated.filter((loc) =>
      loc.toLowerCase().includes(lowerInput)
    );

    if (filteredCurated.length >= 3) {
      return res.status(200).json({
        success: true,
        data: filteredCurated.map((loc) => ({ locality: loc, city })),
      });
    }

    // Attempt Nominatim search for typed input
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          `${input}, ${city}`
        )}&format=json&addressdetails=1&countrycodes=in&limit=10`,
        {
          headers: {
            "User-Agent": "HireInSecond-App/1.0",
          },
        }
      );
      if (nomRes.ok) {
        const nomData = await nomRes.json();
        const nomLocalities = nomData
          .map((item) => {
            const name =
              item.address?.suburb ||
              item.address?.neighbourhood ||
              item.address?.residential ||
              item.name;
            return name ? { locality: name, city } : null;
          })
          .filter(Boolean);

        const seen = new Set();
        const combined = [...filteredCurated.map((loc) => ({ locality: loc, city })), ...nomLocalities].filter(
          (item) => {
            if (seen.has(item.locality.toLowerCase())) return false;
            seen.add(item.locality.toLowerCase());
            return true;
          }
        );

        if (combined.length > 0) {
          return res.status(200).json({ success: true, data: combined });
        }
      }
    } catch (nomErr) {
      console.warn("Nominatim fallback error:", nomErr.message);
    }

    return res.status(200).json({
      success: true,
      data: filteredCurated.map((loc) => ({ locality: loc, city })),
    });
  }

  // Empty input -> return base curated list for city
  if (curated.length > 0) {
    return res.status(200).json({
      success: true,
      data: curated.map((loc) => ({ locality: loc, city })),
    });
  }

  // If city not in curated list, attempt Nominatim text search
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        `localities in ${city}`
      )}&format=json&addressdetails=1&countrycodes=in&limit=10`,
      {
        headers: {
          "User-Agent": "HireInSecond-App/1.0",
        },
      }
    );
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      const nomLocalities = nomData
        .map((item) => {
          const name = item.name || item.display_name?.split(",")[0];
          return name ? { locality: name, city } : null;
        })
        .filter(Boolean);

      return res.status(200).json({ success: true, data: nomLocalities });
    }
  } catch (nomErr) {
    console.warn("Nominatim fallback error:", nomErr.message);
  }

  return res.status(200).json({
    success: true,
    data: [],
  });
};

const detectIpLocation = async (req, res) => {
  try {
    const rawIp =
      req.headers?.["x-forwarded-for"]?.split(",")?.[0]?.trim() ||
      req.headers?.["x-real-ip"] ||
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      req.ip ||
      "";
    const cleanIp = String(rawIp).replace(/^::ffff:/, "").trim();
    const isLocal =
      !cleanIp ||
      cleanIp === "127.0.0.1" ||
      cleanIp === "::1" ||
      cleanIp.startsWith("192.168.") ||
      cleanIp.startsWith("10.");

    const url = isLocal
      ? "http://ip-api.com/json/"
      : `http://ip-api.com/json/${cleanIp}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "HireInSecond-API/1.0 (contact@hireinsecond.com)",
        Accept: "application/json",
      },
      timeout: 5000,
    }).catch(() => null);

    if (response && response.ok) {
      const data = await response.json();
      if (data.status === "success" || data.city) {
        return res.status(200).json({
          success: true,
          message: "Location detected via Network IP",
          data: {
            city: data.city || "Delhi",
            state: data.regionName || data.region || "Delhi",
            country: data.country || "India",
            countryCode: data.countryCode || "IN",
            lat: data.lat,
            lon: data.lon,
            source: "network_ip",
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Default Indian metropolitan hub fallback",
      data: {
        city: "Delhi",
        state: "Delhi",
        country: "India",
        countryCode: "IN",
        lat: 28.6139,
        lon: 77.209,
        source: "default_fallback",
      },
    });
  } catch (error) {
    console.error("detectIpLocation error:", error.message);
    return res.status(200).json({
      success: true,
      data: {
        city: "Delhi",
        state: "Delhi",
        country: "India",
        countryCode: "IN",
        source: "error_fallback",
      },
    });
  }
};

module.exports = {
  getAddressFromCoOrdintes,
  getCountries,
  getStates,
  getLocalities,
  detectIpLocation,
};

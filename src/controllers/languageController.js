const LocalizationMaster = require("../models/languageModal");

const getLocalization = async (req, res) => {
  try {
    const data = await LocalizationMaster.find();
    console.log(data);
    const categorizedData = data.reduce((result, item) => {
      const category = item.Category
        ? item.Category.trim().toUpperCase()
        : "Uncategorized";
      if (!result[category]) {
        result[category] = [];
      }

      const dynamicFields = Object.keys(item._doc)
        .filter((key) => key !== "_id" && key !== "Category")
        .reduce((obj, key) => {
          obj[key] = item[key];
          return obj;
        }, {});

      result[category].push({
        ...dynamicFields,
        Category: item.Category,
      });

      return result;
    }, {});

    res.status(200).json({ data: categorizedData });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve localization data" });
  }
};

module.exports = { getLocalization };

# Manage folders and saved models

## Choose asset folders

Open **File > Asset folders…**. The dialog has separate rows for **Textures**, **XML models**, and **Other assets**.

Choose the folder that belongs to each row. A remembered folder is a permitted location that the app can read again. It is different from a downloaded backup.

In supported Chrome and Edge configurations, the browser can remember the folder. On a later visit, it can reconnect automatically or ask you to select **Reconnect folders**.

If a folder moves or permission is lost, reconnect it or choose it again.

## Use the one-time picker

Browsers can refuse to remember protected folders. This can affect game folders under Program Files and ship folders under AppData.

If the folder chooser reports **Can't open this folder**:

1. Return to **File > Asset folders…**.
2. Select **Use one-time picker…** when offered.
3. Choose the folder again.

The app can keep copies of ship files and loaded textures in browser storage. The browser does not need to retain permission to the original folder for those copies.

A one-time ship-folder copy does not update itself when you save new ships in the game. Use **Refresh…** and choose the folder again to read its current contents.

Browsers without remembered-folder support use a one-time picker.

## Find a ship in the model browser

After you choose an XML model folder, use its model browser to:

- Search by filename or subfolder.
- Examine block count, file size, and date.
- Mark **Favorites**.
- Reopen a file from **Recent**.

Double-click a model, or select it and press **Enter**, to open it. Large folders can take time to scan on their first use.

**Forget** stops remembering the folder. For a saved folder copy, it removes that browser copy. It does not remove the files on your disk.

## Understand where files go

Opening a file reads it into the app. Saving a ship or export produces a browser download. Find downloaded files through your browser's download list or configured download folder.

The app does not turn browser storage into a backup folder. Download the files you need before clearing site data, changing browsers, or changing devices.

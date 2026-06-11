' Inicia el journal sin mostrar ventana negra (para arranque con Windows)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c npm run start", 0, False

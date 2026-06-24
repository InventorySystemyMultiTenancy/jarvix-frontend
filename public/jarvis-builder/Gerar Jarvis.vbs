On Error Resume Next

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
script = fso.BuildPath(base, "builder_gui.pyw")

commands = Array( _
    "pyw -3.13 """ & script & """", _
    "pyw -3.12 """ & script & """", _
    "pyw -3.11 """ & script & """", _
    "pyw -3 """ & script & """", _
    "pythonw """ & script & """" _
)

For Each command In commands
    Err.Clear
    result = shell.Run(command, 0, False)
    If Err.Number = 0 Then
        WScript.Quit 0
    End If
Next

MsgBox "Nao consegui abrir a interface do Jarvis Builder. Instale o Python 3 pelo site python.org e tente novamente.", 16, "Jarvis Builder"

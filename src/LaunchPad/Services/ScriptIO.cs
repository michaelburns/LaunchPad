using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Management.Automation.Language;


namespace LaunchPad.Services
{
    public class ScriptIO
    {

        static string folderLocation = Startup.Configuration["PowerShellScripts:FolderLocation"];
        static string extention = Startup.Configuration["PowerShellScripts:FileExtention"];

        public static bool Write(string name, string text)
        {
            string filename = name + extention;
            string fileLocation = Path.Combine(folderLocation, filename);

            File.WriteAllText(fileLocation, text);

            return File.Exists(fileLocation);
        }

        public static string Read(string name)
        {
            return File.ReadAllText(FileLocation(name));
        }

        public static bool Delete(string name)
        {
            File.Delete(FileLocation(name));
            return !File.Exists(FileLocation(name));
        }

        public static string FileLocation(string name)
        {
            string filename = name + extention;
            return Path.Combine(folderLocation, filename);
        }

        public static bool ScriptExists(string name)
        {
            return File.Exists(FileLocation(name));
        }

        //Solution from http://stackoverflow.com/questions/26390833/
        public static Dictionary<string, string> ScriptParams(string name)
        {
            if (!ScriptExists(name)) return null;
            Token[] tokens;
            ParseError[] errors;
            //Abstract Syntax Tree from Script
            var ast = Parser.ParseInput(Read(name), out tokens, out errors);
            if (errors.Length != 0 || ast.ParamBlock == null) return null;

            return ast.ParamBlock.Parameters.ToDictionary(param => param.Name.ToString(), param => param.StaticType.Name);
        }
    }
}

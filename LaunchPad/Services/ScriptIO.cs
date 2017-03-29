using Microsoft.Extensions.Configuration;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Management.Automation.Language;


namespace LaunchPad.Services
{
    // TODO: Might want to use DI for this class for testing
    public class ScriptIO : IScriptIO
    {

        public ScriptIO(IConfigurationRoot config)
        {
            _folderLocation = config["PowerShellScripts:FolderLocation"];
            _extention = config["PowerShellScripts:FileExtention"];
        }


        private string _folderLocation;
        private string _extention;

        public bool Write(string name, string text)
        {
            string filename = name + _extention;
            string fileLocation = Path.Combine(_folderLocation, filename);

            File.WriteAllText(fileLocation, text);

            return File.Exists(fileLocation);
        }

        public string Read(string name)
        {
            return File.ReadAllText(FileLocation(name));
        }

        public bool Delete(string name)
        {
            File.Delete(FileLocation(name));
            return !File.Exists(FileLocation(name));
        }

        public string FileLocation(string name)
        {
            string filename = name + _extention;
            return Path.Combine(_folderLocation, filename);
        }

        public bool ScriptExists(string name)
        {
            return File.Exists(FileLocation(name));
        }

        //Solution from http://stackoverflow.com/questions/26390833/
        public Dictionary<string, string> ScriptParams(string name)
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
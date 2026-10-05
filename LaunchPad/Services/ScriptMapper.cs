using LaunchPad.Models;
using LaunchPad.ViewModels;

namespace LaunchPad.Services
{
    public static class ScriptMapper
    {
        public static Script ToScript(this PowerShellViewModel vm) => new Script
        {
            Id = vm.Id,
            Name = vm.Name,
            Category = vm.Category
        };

        public static PowerShellViewModel ToViewModel(this Script script) => new PowerShellViewModel
        {
            Id = script.Id,
            Name = script.Name,
            Category = script.Category
        };
    }
}

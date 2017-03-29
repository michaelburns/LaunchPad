using System.ComponentModel.DataAnnotations;

namespace LaunchPad.ViewModels
{
    public class PowerShellViewModel
    {
        public int Id { get; set; } // TODO: Reivew if id is necessary in the VM
        public string Name { get; set; }

        [DataType(DataType.MultilineText)]
        public string Script { get; set; }
    }
}

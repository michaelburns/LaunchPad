using LaunchPad.Models;
using System.ComponentModel.DataAnnotations;

namespace LaunchPad.ViewModels
{
    public class PowerShellViewModel
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Name is required.")]
        [RegularExpression(@"^[A-Za-z0-9_\-]+$",
            ErrorMessage = "Letters, numbers, dashes, and underscores only — this becomes the .ps1 filename on disk.")]
        public string Name { get; set; }

        public Category Category { get; set; }

        [Required(ErrorMessage = "Add at least one line of PowerShell.")]
        [MinLength(1)]
        [DataType(DataType.MultilineText)]
        public string Script { get; set; }
    }
}
